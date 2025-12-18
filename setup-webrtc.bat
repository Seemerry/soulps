@echo off
echo 正在为海龟汤WebRTC语音聊天功能安装依赖...

echo.
echo 步骤1: 安装后端依赖 (socket.io)
cd soulp-server
npm install socket.io@4.7.4 --save
if %errorlevel% neq 0 (
    echo 后端依赖安装失败!
    exit /b %errorlevel%
)

echo.
echo 步骤2: 安装前端依赖 (socket.io-client)
cd ../soulp-client
npm install socket.io-client@4.7.4 --save
if %errorlevel% neq 0 (
    echo 前端依赖安装失败!
    exit /b %errorlevel%
)

echo.
echo 安装完成! 现在可以重启服务器和客户端应用以启用语音聊天功能.
echo.
echo 启动步骤:
echo 1. 首先启动后端: cd soulp-server && npm start
echo 2. 然后启动前端: cd soulp-client && npm run dev
echo.
echo 语音使用方法：
echo - 进入房间后，点击空麦位可以上麦
echo - 上麦后，点击麦克风图标可以切换静音状态
echo - 说话时会有绿色光晕指示
echo.

pause 