/**
 * WebRTC语音通话服务
 * 管理房间内用户之间的语音通信
 */

// 导入socket.io-client
import { io } from 'socket.io-client';

class RTCService {
  constructor() {
    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    this.peerConnections = {};
    this.localStream = null;
    this.mediaConstraints = {
      audio: true,
      video: false
    };
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.nickname = null;
    this.isConnected = false;
    this.onUserJoined = null;
    this.onUserLeft = null;
    this.onSpeaking = null;
    this.onMicStatusChanged = null;
    this.isMuted = false;
    this.currentMicPosition = -1;
  }

  /**
   * 初始化WebRTC服务
   * @param {Object} config - 配置信息
   * @param {string} config.roomId - 房间ID
   * @param {string} config.userId - 用户ID
   * @param {string} config.nickname - 用户昵称
   * @param {string} config.socketUrl - 信令服务器URL
   */
  async initialize(config) {
    console.log('初始化WebRTC服务', config);
    this.roomId = config.roomId;
    this.userId = config.userId;
    this.nickname = config.nickname;
    
    try {
      // 请求麦克风权限
      this.localStream = await navigator.mediaDevices.getUserMedia(this.mediaConstraints);
      console.log('获取到本地麦克风流', this.localStream);
      
      // 初始默认为静音状态
      this.setMute(true);
      
      // 分析音频流以检测说话
      this.setupVoiceActivityDetection();
      
      // 连接信令服务器
      await this.connectSignalServer(config.socketUrl);
      
      return { success: true };
    } catch (error) {
      console.error('初始化WebRTC服务失败:', error);
      return { 
        success: false, 
        error: error.message || '无法访问麦克风'
      };
    }
  }

  /**
   * 连接信令服务器
   * @param {string} socketUrl - 信令服务器URL
   */
  async connectSignalServer(socketUrl) {
    // 如果已经连接，先断开旧连接
    if (this.socket && this.isConnected) {
      console.log('已有连接存在，断开旧连接后重新连接');
      this.socket.disconnect();
      this.isConnected = false;
      
      // 等待一小段时间确保连接已断开
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return new Promise((resolve, reject) => {
      try {
        console.log('开始连接信令服务器:', socketUrl);
        console.log('连接参数:', {
          roomId: this.roomId,
          userId: this.userId,
          nickname: this.nickname
        });
        
        this.socket = io(socketUrl, {
          query: {
            roomId: this.roomId,
            userId: this.userId,
            nickname: this.nickname
          },
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000
        });
        
        // 设置信令事件处理
        this.setupSignalEvents();
        
        this.socket.on('connect', () => {
          console.log('已连接到信令服务器');
          this.isConnected = true;
          resolve();
        });
        
        this.socket.on('connect_error', (error) => {
          console.error('连接信令服务器失败:', error);
          this.isConnected = false;
          reject(error);
        });
        
        this.socket.on('disconnect', (reason) => {
          console.log('从信令服务器断开连接:', reason);
          this.isConnected = false;
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`重新连接成功，尝试次数: ${attemptNumber}`);
          this.isConnected = true;
        });
        
        this.socket.on('reconnect_failed', () => {
          console.error('重新连接失败，已达到最大尝试次数');
          this.isConnected = false;
        });
        
        // 添加超时处理
        setTimeout(() => {
          if (!this.isConnected) {
            console.error('连接信令服务器超时');
            reject(new Error('连接信令服务器超时'));
          }
        }, 10000);
      } catch (error) {
        console.error('连接信令服务器过程中发生错误:', error);
        this.isConnected = false;
        reject(error);
      }
    });
  }

  /**
   * 设置信令事件处理
   */
  setupSignalEvents() {
    if (!this.socket) return;
    
    // 新用户加入房间
    this.socket.on('user-joined', async (data) => {
      console.log('新用户加入房间:', data);
      await this.createPeerConnection(data.userId, data.nickname);
      
      if (typeof this.onUserJoined === 'function') {
        this.onUserJoined(data);
      }
    });
    
    // 用户离开房间
    this.socket.on('user-left', (data) => {
      console.log('用户离开房间:', data);
      this.closePeerConnection(data.userId);
      
      if (typeof this.onUserLeft === 'function') {
        this.onUserLeft(data);
      }
    });
    
    // 接收到offer
    this.socket.on('offer', async (data) => {
      console.log('收到offer:', data);
      const pc = await this.createPeerConnection(data.from, data.nickname);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        this.socket.emit('answer', {
          answer,
          to: data.from,
          from: this.userId,
          nickname: this.nickname
        });
      } catch (error) {
        console.error('处理offer失败:', error);
      }
    });
    
    // 接收到answer
    this.socket.on('answer', async (data) => {
      console.log('收到answer:', data);
      const pc = this.peerConnections[data.from];
      
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (error) {
          console.error('处理answer失败:', error);
        }
      }
    });
    
    // 接收到ice candidate
    this.socket.on('ice-candidate', async (data) => {
      console.log('收到ice candidate:', data);
      const pc = this.peerConnections[data.from];
      
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('添加ice candidate失败:', error);
        }
      }
    });
    
    // 麦克风状态变化
    this.socket.on('mic-status-changed', (data) => {
      console.log('用户麦克风状态变化:', data);
      
      if (typeof this.onMicStatusChanged === 'function') {
        this.onMicStatusChanged(data);
      }
    });
  }

  /**
   * 创建与其他用户的点对点连接
   * @param {string} userId - 对方用户ID
   * @param {string} nickname - 对方用户昵称
   */
  async createPeerConnection(userId, nickname) {
    // 如果已经存在连接，则返回
    if (this.peerConnections[userId]) {
      return this.peerConnections[userId];
    }
    
    try {
      // 创建新的RTCPeerConnection
      const pc = new RTCPeerConnection(this.configuration);
      this.peerConnections[userId] = pc;
      
      // 添加本地音频轨道到连接
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
      
      // 处理ICE候选
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('ice-candidate', {
            candidate: event.candidate,
            to: userId,
            from: this.userId
          });
        }
      };
      
      // 处理连接状态变化
      pc.onconnectionstatechange = () => {
        console.log(`与用户${userId}的连接状态:`, pc.connectionState);
      };
      
      // 处理接收到的远程媒体流
      pc.ontrack = (event) => {
        console.log(`收到用户${userId}的音频轨道`);
        const audioElement = document.createElement('audio');
        audioElement.id = `remote-audio-${userId}`;
        audioElement.srcObject = event.streams[0];
        audioElement.autoplay = true;
        document.body.appendChild(audioElement);
        
        // 设置音频分析器
        this.setupRemoteVoiceDetection(userId, event.streams[0]);
      };
      
      // 如果我们是主动连接方，创建并发送offer
      if (!this.peerConnections[userId].isNegotiating) {
        this.peerConnections[userId].isNegotiating = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        this.socket.emit('offer', {
          offer,
          to: userId,
          from: this.userId,
          nickname: this.nickname
        });
      }
      
      return pc;
    } catch (error) {
      console.error('创建点对点连接失败:', error);
      throw error;
    }
  }

  /**
   * 关闭与用户的连接
   * @param {string} userId - 用户ID
   */
  closePeerConnection(userId) {
    const pc = this.peerConnections[userId];
    if (pc) {
      pc.close();
      delete this.peerConnections[userId];
      
      // 移除远程音频元素
      const audioElement = document.getElementById(`remote-audio-${userId}`);
      if (audioElement) {
        audioElement.remove();
      }
    }
  }

  /**
   * 设置本地音频活动检测
   */
  setupVoiceActivityDetection() {
    if (!this.localStream) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(this.localStream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
    
    // 检测声音
    javascriptNode.onaudioprocess = () => {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      let values = 0;
      
      for (let i = 0; i < array.length; i++) {
        values += array[i];
      }
      
      const average = values / array.length;
      const isSpeaking = average > 20 && !this.isMuted;
      
      if (this.lastSpeakingState !== isSpeaking) {
        this.lastSpeakingState = isSpeaking;
        
        // 通知UI更新说话状态
        if (typeof this.onSpeaking === 'function') {
          this.onSpeaking({
            userId: this.userId,
            isSpeaking
          });
        }
      }
    };
  }

  /**
   * 设置远程用户的语音活动检测
   * @param {string} userId - 用户ID
   * @param {MediaStream} stream - 媒体流
   */
  setupRemoteVoiceDetection(userId, stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
    
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    analyser.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
    
    // 检测声音
    javascriptNode.onaudioprocess = () => {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      let values = 0;
      
      for (let i = 0; i < array.length; i++) {
        values += array[i];
      }
      
      const average = values / array.length;
      const isSpeaking = average > 20;
      
      // 保存上一次说话状态
      if (!this.remoteSpeakingStates) {
        this.remoteSpeakingStates = {};
      }
      
      if (this.remoteSpeakingStates[userId] !== isSpeaking) {
        this.remoteSpeakingStates[userId] = isSpeaking;
        
        // 通知UI更新说话状态
        if (typeof this.onSpeaking === 'function') {
          this.onSpeaking({
            userId,
            isSpeaking
          });
        }
      }
    };
  }

  /**
   * 设置麦克风静音状态
   * @param {boolean} muted - 是否静音
   */
  setMute(muted) {
    this.isMuted = muted;
    
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
    
    // 发送麦克风状态变化到服务器
    if (this.socket && this.isConnected) {
      this.socket.emit('mic-status-changed', {
        userId: this.userId,
        isMuted: muted
      });
    }
    
    return { success: true, isMuted: muted };
  }

  /**
   * 切换麦克风静音状态
   */
  toggleMute() {
    return this.setMute(!this.isMuted);
  }

  /**
   * 加入麦位
   * @param {number} position - 麦位号
   */
  joinMic(position) {
    if (!this.socket || !this.isConnected) {
      console.error('未连接到信令服务器，无法上麦');
      return false;
    }
    
    // 检查是否已有麦位，如果有则先下麦
    if (this.currentMicPosition >= 0 && this.currentMicPosition !== position) {
      console.log(`已在${this.currentMicPosition + 1}号麦上，先下麦`);
      this.leaveMic();
      
      // 添加短暂延迟，确保服务器有时间处理下麦请求
      setTimeout(() => {
        console.log(`上${position + 1}号麦`);
        this.currentMicPosition = position;
        this.socket.emit('join-mic', { position });
      }, 300);
      
      return true;
    }
    
    console.log(`上${position + 1}号麦`);
    this.currentMicPosition = position;
    this.socket.emit('join-mic', { position });
    return true;
  }

  /**
   * 离开麦位
   */
  leaveMic() {
    if (!this.socket || !this.isConnected) {
      console.error('未连接到信令服务器，无法下麦');
      return false;
    }
    
    console.log('下麦');
    this.socket.emit('leave-mic');
    this.currentMicPosition = -1;
    return true;
  }

  /**
   * 断开连接并释放资源
   */
  disconnect() {
    console.log('断开WebRTC连接');
    
    // 释放本地媒体流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    // 关闭所有点对点连接
    Object.keys(this.peerConnections).forEach(userId => {
      this.closePeerConnection(userId);
    });
    
    // 断开信令服务器连接
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    
    return { success: true };
  }
}

// 导出单例
const rtcService = new RTCService();
export default rtcService; 