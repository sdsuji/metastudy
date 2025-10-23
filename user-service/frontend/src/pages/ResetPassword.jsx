import { useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './Form.css';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords do not match");
      setMessageType("error");
      return;
    }

    try {
      const res = await axios.post(`http://localhost:5000/api/users/reset-password/${token}`, { password });
      setMessage(res.data.msg);
      setMessageType("success");
    } catch (err) {
      setMessage(err.response?.data?.msg || "Error resetting password");
      setMessageType("error");
    }
  };

  return (
    <div className="form-container">
      <form className="form-box" onSubmit={handleSubmit}>
        <h2>Reset Password</h2>
        <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} />
        <input type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        <button type="submit">Reset</button>
        {message && <div className={`form-message ${messageType}`}>{message}</div>}
      </form>
    </div>
  );
};

export default ResetPassword;
