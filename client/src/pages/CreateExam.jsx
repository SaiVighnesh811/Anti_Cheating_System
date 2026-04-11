import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PlusCircle, Trash2, ArrowLeft, Save } from 'lucide-react';

const CreateExam = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [questions, setQuestions] = useState([
    { questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fixed the title initialization
  React.useEffect(() => {
    setTitle('');
  }, []);

  // Auto-calculate end time based on start time and duration
  React.useEffect(() => {
    if (startTime && durationMinutes) {
      try {
        const start = new Date(startTime);
        if (!isNaN(start.getTime())) {
          const end = new Date(start.getTime() + durationMinutes * 60000);
          
          // Format to YYYY-MM-DDTHH:mm for datetime-local input
          const year = end.getFullYear();
          const month = String(end.getMonth() + 1).padStart(2, '0');
          const day = String(end.getDate()).padStart(2, '0');
          const hours = String(end.getHours()).padStart(2, '0');
          const minutes = String(end.getMinutes()).padStart(2, '0');
          
          setEndTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
      } catch (err) {
        console.error("Error calculating end time:", err);
      }
    }
  }, [startTime, durationMinutes]);

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }]);
  };

  const removeQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...questions];
    newQuestions[index][field] = value;
    setQuestions(newQuestions);
  };

  const updateOption = (qIndex, optIndex, value) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[optIndex] = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // basic validation
    if (!title || questions.length === 0) {
      setError('Title and at least 1 question are required');
      setLoading(false);
      return;
    }

    // deep validation
    for (let q of questions) {
      if (!q.questionText || q.options.some(o => !o)) {
        setError('All questions and options must be filled');
        setLoading(false);
        return;
      }
    }

    try {
      await api.post('/exams', { 
        title, 
        description, 
        durationMinutes, 
        startTime: startTime || null,
        endTime: endTime || null,
        questions 
      });
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px', padding: '2rem', animation: 'fadeIn 0.6s ease-out' }}>
      <button onClick={() => navigate('/admin')} className="btn-secondary" style={{ marginBottom: '2.5rem', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: '600' }}>
        <ArrowLeft size={18} /> Administrative Console
      </button>

      <div className="glass-panel" style={{ padding: '3.5rem', background: '#fff', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>Curate New Assessment</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.05rem' }}>Define evaluation parameters and secure question sets.</p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '1.25rem', borderRadius: '12px', marginBottom: '2.5rem', border: '1px solid rgba(220,38,38,0.1)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment Title</label>
              <input
                type="text"
                className="input-field-enhanced"
                placeholder="e.g. Advanced Thermodynamics Midterm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Duration (m)</label>
              <input
                type="number"
                className="input-field-enhanced"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                required
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule Start (Optional)</label>
              <input 
                type="datetime-local" 
                className="input-field-enhanced"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schedule End (Auto-calculated)</label>
              <input 
                type="datetime-local" 
                className="input-field-enhanced"
                value={endTime}
                readOnly
                style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#f8fafc', cursor: 'not-allowed' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontWeight: '500' }}>Calculated based on start time and duration.</p>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '3rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate Instructions</label>
            <textarea
              className="input-field-enhanced"
              style={{ minHeight: '100px', resize: 'vertical', width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}
              placeholder="Provide context or rules for this examination..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ margin: '4rem 0 2rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--primary-light)', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Question Reservoir</h2>
            <button type="button" onClick={addQuestion} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.2rem', fontWeight: '700' }}>
              <PlusCircle size={18} /> New Question
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {questions.map((q, qIndex) => (
              <div key={qIndex} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', padding: '2rem', borderRadius: '18px', position: 'relative', transition: 'all 0.3s ease' }}>
                <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(qIndex)} className="btn-danger" style={{ padding: '0.5rem', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: 'none' }}>
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <span style={{ background: 'var(--primary)', color: '#fff', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem' }}>{qIndex + 1}</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)' }}>Question Data</h3>
                </div>

                <div className="input-group">
                  <input
                    type="text"
                    className="input-field-enhanced"
                    placeholder="Problem statement..."
                    value={q.questionText}
                    onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                    required
                    style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctOptionIndex === optIndex}
                        onChange={() => updateQuestion(qIndex, 'correctOptionIndex', optIndex)}
                        style={{ cursor: 'pointer', width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                      />
                      <input
                        type="text"
                        className="input-field-enhanced"
                        placeholder={`Option ${optIndex + 1}`}
                        value={opt}
                        onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                        required
                        style={{ padding: '0.5rem 0', border: 'none', background: 'transparent', width: '100%', fontWeight: q.correctOptionIndex === optIndex ? '600' : '400' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '4rem', width: '100%', padding: '1.25rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', fontSize: '1.2rem', fontWeight: '800' }} disabled={loading}>
            <Save size={24} />
            {loading ? 'Committing Changes...' : 'Publish Assessment'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateExam;
