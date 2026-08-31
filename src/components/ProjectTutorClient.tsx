'use client';

import { useState } from 'react';

interface Questions {
  easy: string[];
  medium: string[];
  advanced: string[];
}

interface ProjectTutorClientProps {
  username: string;
}

export default function ProjectTutorClient({ username }: ProjectTutorClientProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [questions, setQuestions] = useState<Questions | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'questions' | 'chat'>('analysis');

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError('');
    setAnalysis('');
    setQuestions(null);

    try {
      const [analysisRes, questionsRes] = await Promise.all([
        fetch('/api/project-tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl, action: 'analyze' }),
        }),
        fetch('/api/project-tutor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl, action: 'questions' }),
        }),
      ]);

      const analysisData = await analysisRes.json();
      const questionsData = await questionsRes.json();

      setAnalysis(analysisData.analysis ?? '');
      setQuestions(questionsData.questions ?? null);
    } catch {
      setError('Failed to analyze repository. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/project-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, action: 'chat', question: userMsg }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', text: data.answer ?? 'No response.' }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Failed to get response. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const difficultyColor = { easy: '#10b981', medium: '#f59e0b', advanced: '#ef4444' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#f1f5f9', padding: '32px clamp(16px, 4vw, 48px)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '999px', padding: '6px 16px', marginBottom: '16px',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>AI PROJECT TUTOR</span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: '8px' }}>
            Prepare for Your Project Interview 🎯
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
            Paste any GitHub repo URL to get AI-generated insights, interview questions, and a chat tutor.
          </p>
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="https://github.com/username/repo"
            style={{
              flex: 1, minWidth: '280px', padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', color: '#f1f5f9', fontSize: '0.95rem', outline: 'none',
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !repoUrl.trim()}
            style={{
              padding: '12px 24px', background: loading ? '#374151' : '#6366f1',
              border: 'none', borderRadius: '10px', color: '#fff',
              fontWeight: 600, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze Repo'}
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        {(analysis || questions) && (
          <>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '4px' }}>
              {(['analysis', 'questions', 'chat'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    background: activeTab === tab ? '#6366f1' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#94a3b8',
                    fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'analysis' ? '📋 Analysis' : tab === 'questions' ? '❓ Questions' : '💬 Ask AI'}
                </button>
              ))}
            </div>

            {/* Analysis tab */}
            {activeTab === 'analysis' && analysis && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.7, color: '#e2e8f0', fontFamily: 'inherit', margin: 0 }}>
                  {analysis}
                </pre>
              </div>
            )}

            {/* Questions tab */}
            {activeTab === 'questions' && questions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {(['easy', 'medium', 'advanced'] as const).map(level => (
                  <div key={level} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${difficultyColor[level]}33`, borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: difficultyColor[level], display: 'inline-block' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: difficultyColor[level], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {level}
                      </span>
                    </div>
                    <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {questions[level].map((q, i) => (
                        <li key={i} style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.6 }}>{q}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}

            {/* Chat tab */}
            {activeTab === 'chat' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ height: '360px', overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {chatHistory.length === 0 && (
                    <p style={{ color: '#64748b', textAlign: 'center', margin: 'auto', fontSize: '0.9rem' }}>
                      Ask anything about your project — implementation details, design decisions, challenges faced...
                    </p>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '10px 14px', borderRadius: '10px',
                        background: msg.role === 'user' ? '#6366f1' : 'rgba(255,255,255,0.06)',
                        color: '#f1f5f9', fontSize: '0.875rem', lineHeight: 1.6,
                      }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: '0.875rem' }}>
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChat()}
                    placeholder="Ask about your project..."
                    style={{
                      flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                      color: '#f1f5f9', fontSize: '0.875rem', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleChat}
                    disabled={chatLoading || !chatInput.trim()}
                    style={{
                      padding: '10px 20px', background: '#6366f1', border: 'none',
                      borderRadius: '8px', color: '#fff', fontWeight: 600,
                      fontSize: '0.875rem', cursor: 'pointer',
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}