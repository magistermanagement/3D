import React, { useRef, useEffect, Suspense, useState } from "react";
import { useGLTF, useFBX, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from 'three';
import useAvatarStore from "../store/avatarStore";
import GeminiService from "../services/geminiService";

// Viseme mapping (same as before)
const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk", 
  C: "viseme_I",
  D: "viseme_AA",
  E: "viseme_O",
  F: "viseme_U",
  G: "viseme_FF",
  H: "viseme_TH",
  X: "viseme_PP",
};

export function Avatar() {
  const audioRef = useRef(null);
  const group = useRef();
  const mixerRef = useRef();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  // Store states (same as before)
  const { 
    audioUrl, 
    isPlaying, 
    lipSyncData, 
    setAudioUrl,
    setLipSyncData,
    setIsPlaying,
    addToConversationHistory,
    conversationHistory
  } = useAvatarStore();

  // Voice recording initialization
  const initializeRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorderRef.current = new MediaRecorder(stream);
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];

          // Convert audio blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64data = reader.result.split(',')[1];
            
            try {
              // Send audio to speech recognition service
              const transcriptionResponse = await GeminiService.transcribeAudio(base64data);
              
              if (transcriptionResponse && transcriptionResponse.text) {
                // Set the transcribed text as input
                setInputText(transcriptionResponse.text);
                
                // Automatically trigger input handling
                await handleUserInput(transcriptionResponse.text);
              }
            } catch (error) {
              console.error('Transcription error:', error);
              alert('Failed to transcribe audio');
            }
          };
        };
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        alert('Microphone access denied');
      });
  };

  // Start recording
  const startRecording = () => {
    if (mediaRecorderRef.current && !isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } else {
      console.warn("Recording is already in progress or MediaRecorder is not initialized.");
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      console.warn("No recording in progress to stop.");
    }
  };

  // Handle user input and get Gemini response
  const handleUserInput = async (providedText) => {
    const textToProcess = providedText || inputText;
    
    if (!textToProcess.trim()) return;

    // Add user message to conversation history
    addToConversationHistory({ 
      role: 'user', 
      content: textToProcess 
    });

    try {
      // Call Gemini service to get a response
      const response = await GeminiService.getResponse(textToProcess);
      if (response && response.text) {
        // Add Gemini's response to conversation history
        addToConversationHistory({
          role: 'assistant',
          content: response.text
        });
        
        // Set the response audio URL to trigger playback
        setAudioUrl(response.audioUrl);
        
        // Set lip sync data if available
        if (response.lipSync) {
          setLipSyncData(response.lipSync);
        }
      }
    } catch (error) {
      console.error('Unexpected error in input handling:', error);
      alert(`An unexpected error occurred: ${error.message}`);
    }

    // Clear input after processing
    setInputText('');
  };

  // Initialize recording on component mount
  useEffect(() => {
    initializeRecording();
  }, []);

  // Add keyboard event listener for 'R' key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'r' || event.key === 'R') {
        if (!isRecording) {
          startRecording();
        } else {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecording]);

  // Load models and animations
  const gltf = useGLTF("/models/66de6b33bb9d79984d437c2f.glb", true);
  const { nodes, materials } = gltf;

  const { animations: standardAnim } = useFBX("/animations/Standard Idle.fbx");
  const { animations: talkingAnim } = useFBX("/animations/Talking.fbx");

  // Setup animations and mixers
  useEffect(() => {
    if (group.current && standardAnim.length > 0) {
      // Create animation mixer
      mixerRef.current = new THREE.AnimationMixer(group.current);
      
      // Prepare idle animation
      const idleAction = mixerRef.current.clipAction(standardAnim[0]);
      idleAction.play();

      // Prepare talking animation if available
      if (talkingAnim.length > 0) {
        const talkAction = mixerRef.current.clipAction(talkingAnim[0]);
        talkAction.setEffectiveWeight(0.5);
      }
    }
  }, [standardAnim, talkingAnim]);

  // Add lighting to the avatar
  useEffect(() => {
    const light = new THREE.DirectionalLight(0xffffff, 0.45); // Darkened light intensity
    light.position.set(5, 5, 5);
    light.castShadow = true;
    group.current.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
    group.current.add(ambientLight);
  }, []);

  // Manage audio playback
  useEffect(() => {
    if (audioUrl) {
      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // When audio starts playing
      audio.addEventListener("play", () => {
        setIsPlaying(true);

        // Transition to talking animation
        if (mixerRef.current && talkingAnim.length > 0) {
          const idleAction = mixerRef.current.clipAction(standardAnim[0]);
          const talkAction = mixerRef.current.clipAction(talkingAnim[0]);
          
          idleAction.crossFadeTo(talkAction, 0.2, true);
          talkAction.play();
        }
      });

      // When audio ends
      audio.addEventListener("ended", () => {
        setIsPlaying(false);

        // Transition back to idle animation
        if (mixerRef.current && standardAnim.length > 0) {
          const idleAction = mixerRef.current.clipAction(standardAnim[0]);
          const talkAction = mixerRef.current.clipAction(talkingAnim[0]);
          
          talkAction.crossFadeTo(idleAction, 0.2, true);
          idleAction.play();
        }
      });

      // Play the audio
      audio.play().catch(console.error);
    }
  }, [audioUrl]);

  // Lip sync and animation update
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // Lip sync logic
    if (!audioRef.current || !isPlaying || !lipSyncData.length) return;

    const currentTime = audioRef.current.currentTime;
    
    const currentViseme = lipSyncData.find(
      (data) => currentTime >= data.start && currentTime <= data.end
    );

    // Apply morphTargets for lip sync
    if (nodes.Wolf3D_Head && nodes.Wolf3D_Teeth) {
      // Reset all morphTargets
      Object.values(corresponding).forEach((value) => {
        if (nodes.Wolf3D_Head.morphTargetDictionary[value] !== undefined) {
          nodes.Wolf3D_Head.morphTargetInfluences[ 
            nodes.Wolf3D_Head.morphTargetDictionary[value]
          ] = 0.1;
        }
        if (nodes.Wolf3D_Teeth.morphTargetDictionary[value] !== undefined) {
          nodes.Wolf3D_Teeth.morphTargetInfluences[ 
            nodes.Wolf3D_Teeth.morphTargetDictionary[value]
          ] = 0.1;
        }
      });

      // Apply current viseme
      if (currentViseme && corresponding[currentViseme.viseme]) {
        const visemeValue = corresponding[currentViseme.viseme];
        
        if (nodes.Wolf3D_Head.morphTargetDictionary[visemeValue] !== undefined) {
          nodes.Wolf3D_Head.morphTargetInfluences[ 
            nodes.Wolf3D_Head.morphTargetDictionary[visemeValue]
          ] = currentViseme.weight || 1;
        }
        
        if (nodes.Wolf3D_Teeth.morphTargetDictionary[visemeValue] !== undefined) {
          nodes.Wolf3D_Teeth.morphTargetInfluences[ 
            nodes.Wolf3D_Teeth.morphTargetDictionary[visemeValue]
          ] = currentViseme.weight || 1;
        }
      }
    }
  });

  return (
    <Suspense fallback={<Html>Loading...</Html>}>
      <group ref={group} dispose={null} position={[0, -0.290, 4.3]}>
        <primitive object={nodes.Hips} />
        <skinnedMesh
          name="EyeLeft"
          geometry={nodes.EyeLeft.geometry}
          material={materials.Wolf3D_Eye}
          skeleton={nodes.EyeLeft.skeleton}
          morphTargetDictionary={nodes.EyeLeft.morphTargetDictionary}
          morphTargetInfluences={nodes.EyeLeft.morphTargetInfluences}
        />
        <skinnedMesh
          name="EyeRight"
          geometry={nodes.EyeRight.geometry}
          material={materials.Wolf3D_Eye}
          skeleton={nodes.EyeRight.skeleton}
          morphTargetDictionary={nodes.EyeRight.morphTargetDictionary}
          morphTargetInfluences={nodes.EyeRight.morphTargetInfluences}
        />
        <skinnedMesh
          name="Wolf3D_Head"
          geometry={nodes.Wolf3D_Head.geometry}
          material={materials.Wolf3D_Skin}
          skeleton={nodes.Wolf3D_Head.skeleton}
          morphTargetDictionary={nodes.Wolf3D_Head.morphTargetDictionary}
          morphTargetInfluences={nodes.Wolf3D_Head.morphTargetInfluences}
        />
        <skinnedMesh
          name="Wolf3D_Teeth"
          geometry={nodes.Wolf3D_Teeth.geometry}
          material={materials.Wolf3D_Teeth}
          skeleton={nodes.Wolf3D_Teeth.skeleton}
          morphTargetDictionary={nodes.Wolf3D_Teeth.morphTargetDictionary}
          morphTargetInfluences={nodes.Wolf3D_Teeth.morphTargetInfluences}
        />
        <skinnedMesh
          geometry={nodes.Wolf3D_Hair.geometry}
          material={materials.Wolf3D_Hair}
          skeleton={nodes.Wolf3D_Hair.skeleton}
        />
        <skinnedMesh
          geometry={nodes.Wolf3D_Glasses.geometry}
          material={materials.Wolf3D_Glasses}
          skeleton={nodes.Wolf3D_Glasses.skeleton}
        />
        <skinnedMesh
          geometry={nodes.Wolf3D_Body.geometry}
          material={materials.Wolf3D_Body}
          skeleton={nodes.Wolf3D_Body.skeleton}
        />
        <skinnedMesh
          geometry={nodes.Wolf3D_Outfit_Bottom.geometry}  
          material={materials.Wolf3D_Outfit_Bottom}
          skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
        />
        <skinnedMesh
          geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
          material={materials.Wolf3D_Outfit_Footwear}
          skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
        />
        <skinnedMesh
          geometry={nodes.Wolf3D_Outfit_Top.geometry}
          material={materials.Wolf3D_Outfit_Top}
          skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
        />
      </group>
      {/* Input interface */}
      <Html position={[0, -1.5, 0]} style={{ pointerEvents: 'auto' }}>
        <div id="chatContainer" style={{
          position: 'absolute', 
          bottom: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <button 
            id="recordButton" 
            onClick={() => {
              if (!isRecording) {
                startRecording();
              } else {
                stopRecording();
              }
            }}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              transform: 'translateY(135px)' 
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="40" 
              height="40" 
              viewBox="0 0 24 24" 
              fill={isRecording ? "red" : "none"} 
              stroke="white" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ 
                backgroundColor: isRecording ? '#ff4444' : '#3498db', 
                borderRadius: '50%', 
                padding: '10px',
                transition: 'all 0.3s ease'
              }}
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="white"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="white"/>
              <line x1="8" y1="23" x2="16" y2="23" stroke="white"/>
            </svg>
          </button>
        </div>
      </Html>
    </Suspense>
  );
}

// Preload models and animations
useGLTF.preload("/models/66de6b33bb9d79984d437c2f.glb");
useFBX.preload("/animations/Standard Idle.fbx");
useFBX.preload("/animations/Talking.fbx");