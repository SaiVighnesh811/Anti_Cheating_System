import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PlusCircle, Trash2, ArrowLeft, Save } from 'lucide-react';

const CreateExam = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questions, setQuestions] = useState([
    { questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fixed the title initialization
  React.useEffect(() => {
    setTitle('');
  }, []);

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
      await api.post('/exams', { title, description, durationMinutes, questions });
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <button onClick={() => navigate('/admin')} className="btn-secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent' }}>
        <ArrowLeft size={18} /> Back to Dashboard
      </button>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '2rem', marginBottom: '1.5rem', margin: '0 0 2rem 0' }}>Create New Exam</h1>
        
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Exam Title</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Midterm Examination" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Duration (Minutes)</label>
              <input 
                type="number" 
                className="input-field" 
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                required 
              />
            </div>
          </div>
          
          <div className="input-group">
            <label>Description / Instructions</label>
            <textarea 
              className="input-field" 
              style={{ minHeight: '80px', resize: 'vertical' }}
              placeholder="Instructions for students..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ margin: '3rem 0 1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Questions</h2>
            <button type="button" onClick={addQuestion} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
              <PlusCircle size={16} /> Add Question
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {questions.map((q, qIndex) => (
              <div key={qIndex} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)', padding: '1.5rem', borderRadius: '12px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(qIndex)} className="btn-danger" style={{ padding: '0.35rem' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--primary)' }}>Question {qIndex + 1}</h3>
                
                <div className="input-group">
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter your question here..." 
                    value={q.questionText}
                    onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input 
                        type="radio" 
                        name={`correct-${qIndex}`} 
                        checked={q.correctOptionIndex === optIndex}
                        onChange={() => updateQuestion(qIndex, 'correctOptionIndex', optIndex)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                      />
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder={`Option ${optIndex + 1}`} 
                        value={opt}
                        onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                        required
                        style={{ padding: '0.6rem 1rem', border: q.correctOptionIndex === optIndex ? '1px solid var(--primary)' : undefined }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '3rem', width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.75rem', fontSize: '1.1rem' }} disabled={loading}>
            <Save size={20} />
            {loading ? 'Saving...' : 'Publish Exam'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateExam;
