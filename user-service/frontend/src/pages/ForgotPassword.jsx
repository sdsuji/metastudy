import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';  
import './Form.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  
  const navigate = useNavigate();  

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await axios.post('http://localhost:5000/api/users/forgot-password', { email });
      setMessage(res.data.msg);
      setMessageType('success');
      setTimeout(() => {
        navigate('/option');  
      }, 3000);
    } catch (err) {
      setMessage(err.response?.data?.msg || 'Something went wrong');
      setMessageType('error');
    }
  };

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={handleSubmit}>
        <h2>Forgot Password</h2>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Enter your registered email"
          required
        />
        <button type="submit">Send Reset Link</button>
        {message && <div className={`form-message ${messageType}`}>{message}</div>}
      </form>
    </div>
  );
};

export default ForgotPassword;
