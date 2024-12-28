import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const WebRTCStreaming = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const socket = useRef(null);
  const dataChannel = useRef(null);
  const mediaRecorder = useRef(null); // MediaRecorder reference
  const [socketId, setSocketId] = useState(null);
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [isRecording, setIsRecording] = useState(false); // Recording state

  const roomId = 'skill-heed-com';

  useEffect(() => {
    const initSocket = () => {
      socket.current = io('http://192.168.0.101:8000');

      socket.current.on('connect', () => {
        setSocketId(socket.current.id);
        socket.current.emit('join-room', roomId);
        setConnectionStatus('Connected');
      });

      socket.current.on('user-joined', id => {
        setRemoteSocketId(id);
        createOffer();
      });

      socket.current.on('signal', async ({ from, signal }) => {
        if (signal.type === 'offer') {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.current.emit('signal', { to: from, from: socketId, signal: answer });
        } else if (signal.type === 'answer') {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      });

      socket.current.on('users-list', users => setConnectedUsers(users));
      socket.current.on('ping-response', () => setConnectionStatus('Connected'));
      socket.current.on('media-chunk', (data) => {
        // Handle incoming media chunks if needed
      });
    };

    const initMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;

        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        peerConnection.current = new RTCPeerConnection(config);

        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.onicecandidate = event => {
          if (event.candidate) {
            socket.current.emit('signal', { to: remoteSocketId, from: socketId, signal: event.candidate });
          }
        };

        dataChannel.current = peerConnection.current.createDataChannel('dataChannel');
        dataChannel.current.onopen = () => console.log('Data channel is open');
        dataChannel.current.onmessage = event => console.log('Received message:', event.data);

        peerConnection.current.ondatachannel = event => {
          event.channel.onmessage = event => console.log('Received message:', event.data);
        };

        peerConnection.current.ontrack = event => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };
      } catch (error) {
        console.error('Error accessing media devices.', error);
      }
    };

    initSocket();
    initMediaStream();

    return () => {
      socket.current.disconnect();
    };
  }, []);

  const createOffer = async () => {
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.current.emit('signal', { to: remoteSocketId, from: socketId, signal: offer });
  };

  const sendMessage = message => {
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send(message);
    }
  };

  const startRecordingAndSending = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject;

      const streamKey = 'skill-1234'; 

      startEventMeet(streamKey);

      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'video/webm' });

      mediaRecorder.current.ondataavailable = event => {
        if (event.data.size > 0) {
          sendMediaChunk(event.data);
        }
      };

      mediaRecorder.current.start(1000); // Start recording, and fire the dataavailable event every 1 second
      setIsRecording(true);
    }
  };

  const startEventMeet = (streamKey) => {
    console.log('Event meet started with stream key:', streamKey);
    socket.current.emit('start-event', { streamKey }); // Send streamKey to the server
  };

  const stopRecordingAndSending = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const sendMediaChunk = chunk => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      socket.current.emit('video_data', arrayBuffer);
    };
    reader.readAsArrayBuffer(chunk);
  };

  return (
    <div>
      <video ref={localVideoRef} autoPlay playsInline />
      <video ref={remoteVideoRef} autoPlay playsInline />
      <button onClick={() => sendMessage('Hello, this is a binary message!')}>Send Message</button>
      <button onClick={startRecordingAndSending} disabled={isRecording}>
        Start Recording and Sending
      </button>
      <button onClick={stopRecordingAndSending} disabled={!isRecording}>
        Stop Recording and Sending
      </button>
    </div>
  );
};

export default WebRTCStreaming;
