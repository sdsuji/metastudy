import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ClassroomMeeting.css';

const ClassroomMeeting = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const jitsiContainerRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/option');
      return;
    }

    const loadJitsi = () => {
      if (!window.JitsiMeetExternalAPI) {
        alert('Jitsi script not loaded');
        return;
      }

      const domain = "meet.jit.si";
      const options = {
        roomName: `MetaStudy-${id}`,
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: user.name
        },
        configOverwrite: {
          prejoinPageEnabled: false, // skip the "waiting for user" page
          startWithAudioMuted: false,
          startWithVideoMuted: false,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone','camera','chat','hangup','fullscreen','tileview'
          ],
        },
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);

      // Optional: Listen to events
      api.addEventListener('videoConferenceJoined', () => {
        console.log(`${user.name} joined the meeting`);
      });

      api.addEventListener('readyToClose', () => {
        navigate('/dashboard'); // go back when meeting ends
      });
    };

    // Load the Jitsi script dynamically if not already loaded
    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = loadJitsi;
      document.body.appendChild(script);
    } else {
      loadJitsi();
    }
  }, [id, user, navigate]);

  return (
    <div className="meeting-container">
      <button className="back-btn" onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </button>
      <div ref={jitsiContainerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default ClassroomMeeting;
