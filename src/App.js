import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [authMode, setAuthMode] = useState(''); 
  const [currentUser, setCurrentUser] = useState(null); 
  
  const [phoneInput, setPhoneInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const [competitions, setCompetitions] = useState([]);
  const [participations, setParticipations] = useState({});
  const [newComp, setNewComp] = useState({ title: '', date: '', location: '', course: '', category: '철인3종' });
  const [selectedYear, setSelectedYear] = useState('전체'); 
  const [editingComp, setEditingComp] = useState(null); 
  const [enlargedImage, setEnlargedImage] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('tri_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      const { data: comps } = await supabase.from('competitions').select('*').eq('user_id', currentUser.phone).order('date', { ascending: false });
      setCompetitions(comps || []);

      const { data: parts } = await supabase.from('participations').select('*').eq('user_id', currentUser.phone);
      const partsMap = {};
      parts?.forEach(p => partsMap[p.comp_id] = p);
      setParticipations(partsMap);
    };

    fetchData();
  }, [currentUser]);

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!phoneInput || !pwInput || !nameInput) return;

    const { data: existing } = await supabase.from('users').select('*').eq('phone', phoneInput);
    if (existing && existing.length > 0) {
      setAuthMode('login');
      return;
    }

    const { error } = await supabase.from('users').insert([{ phone: phoneInput, password: pwInput, name: nameInput }]);
    if (!error) {
      setAuthMode('login');
      setPwInput('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('users').select('*').eq('phone', phoneInput).eq('password', pwInput);
    
    if (!error && data && data.length > 0) {
      const userData = data[0];
      setCurrentUser(userData);
      localStorage.setItem('tri_user', JSON.stringify(userData));
      setAuthMode('');
      setPhoneInput('');
      setPwInput('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tri_user');
    setCurrentUser(null);
    setParticipations({});
  };

  const handleAddCompetition = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('competitions').insert([{
      ...newComp,
      user_id: currentUser.phone
    }]);

    if (!error) {
      setNewComp({ title: '', date: '', location: '', course: '', category: '철인3종' });
      window.location.reload(); 
    }
  };

  const handleDelete = async (compId) => {
    if (!window.confirm('정말로 이 대회를 삭제하시겠습니까?')) return;

    await supabase.from('participations').delete().eq('comp_id', compId);
    const { error } = await supabase.from('competitions').delete().eq('id', compId);
    if (!error) {
      window.location.reload();
    }
  };

  const handleEditSubmit = async (e, compId) => {
    e.preventDefault();
    const { error } = await supabase.from('competitions').update({
      title: editingComp.title,
      date: editingComp.date,
      location: editingComp.location,
      course: editingComp.course,
      category: editingComp.category
    }).eq('id', compId);

    if (!error) {
      setEditingComp(null); 
      window.location.reload();
    }
  };

  const handleParticipate = async (compId, status) => {
    await supabase.from('participations').upsert({ 
      user_id: currentUser.phone, 
      comp_id: compId, 
      status 
    }, { onConflict: 'user_id, comp_id' });
    window.location.reload();
  };

  const handleFileUpload = async (e, compId) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.phone}_${compId}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
    if (uploadError) return;

    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    const reviewText = prompt("대회후기 소감을 간략하게 남겨주세요 \n※ 사진만 등록하려면 빈칸으로 두세요");
    
    await supabase.from('participations').upsert({
      user_id: currentUser.phone,
      comp_id: compId,
      status: '참가',
      review: reviewText || null,
      photo_url: photoUrl
    }, { onConflict: 'user_id, comp_id' });

    window.location.reload();
  };

  const availableYears = ['전체', ...new Set(competitions.map(comp => comp.date.substring(0, 4)))].sort((a, b) => b - a);
  const filteredCompetitions = selectedYear === '전체' 
    ? competitions 
    : competitions.filter(comp => comp.date.startsWith(selectedYear));

  if (!currentUser) {
    return (
      <div style={{ padding: '30px', maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>🏊🚴🏃 Tri-Planner</h2>
        
        {authMode === '' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ textAlign: 'center', color: '#666' }}>서비스를 이용하려면 로그인이 필요합니다.</p>
            <button onClick={() => setAuthMode('login')} style={{ padding: '12px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>로그인하기</button>
            <button onClick={() => setAuthMode('signup')} style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>회원가입하기</button>
          </div>
        )}

        {authMode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3>로그인</h3>
            <input placeholder="전화번호 (예: 01012345678)" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}/>
            <input type="password" placeholder="비밀번호" value={pwInput} onChange={e => setPwInput(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}/>
            <button type="submit" style={{ padding: '12px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>로그인</button>
            <button type="button" onClick={() => setAuthMode('')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginTop: '10px' }}>← 처음으로</button>
          </form>
        )}

        {authMode === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3>회원가입</h3>
            <input placeholder="이름 (닉네임)" value={nameInput} onChange={e => setNameInput(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}/>
            <input placeholder="전화번호 (예: 01012345678)" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}/>
            <input type="password" placeholder="비밀번호" value={pwInput} onChange={e => setPwInput(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}/>
            <button type="submit" style={{ padding: '12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>가입완료</button>
            <button type="button" onClick={() => setAuthMode('')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginTop: '10px' }}>← 처음으로</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '10px 15px', borderRadius: '8px', marginBottom: '20px' }}>
        <span>👤 <b>{currentUser.name}</b>님 환영합니다!</span>
        <button onClick={handleLogout} style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>로그아웃</button>
      </div>

      <h2 style={{ textAlign: 'center' }}>🏊🚴🏃 Tri-Planner 스케줄러</h2>
      
      <form onSubmit={handleAddCompetition} style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>[관리자] 대회 수동 등록</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <select value={newComp.category} onChange={e => setNewComp({...newComp, category: e.target.value})} style={{ padding: '8px' }}>
            <option value="철인3종">1. 철인3종</option>
            <option value="듀애슬론">2. 듀애슬론</option>
            <option value="아쿠아슬론">3. 아쿠아슬론</option>
            <option value="마라톤">4. 마라톤</option>
            <option value="트레일런">5. 트레일런</option>
            <option value="수영대회">6. 수영대회</option>
            <option value="그란폰도">7. 그란폰도</option>
          </select>
          <input placeholder="대회명 (예: 통영 트라이애슬론)" value={newComp.title} onChange={e => setNewComp({...newComp, title: e.target.value})} required style={{ padding: '8px' }}/>
          <input type="date" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} required style={{ padding: '8px' }}/>
          <input placeholder="장소 (예: 경남 통영)" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} required style={{ padding: '8px' }}/>
          <input placeholder="코스 (예: 올림픽)" value={newComp.course} onChange={e => setNewComp({...newComp, course: e.target.value})} required style={{ padding: '8px' }}/>
          <button type="submit" style={{ padding: '10px', backgroundColor: '#333', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>새로운 대회 등록하기</button>
        </div>
      </form>

      <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>🏆 대회 일정</h3>
        <select 
          value={selectedYear} 
          onChange={(e) => setSelectedYear(e.target.value)} 
          style={{ padding: '6px 12px', fontSize: '15px', borderRadius: '4px' }}
        >
          {availableYears.map(year => (
            <option key={year} value={year}>{year === '전체' ? '전체 보기' : `${year}년`}</option>
          ))}
        </select>
      </div>

      {filteredCompetitions.length === 0 && (
          <p style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>해당 조건에 등록된 대회가 없습니다.</p>
      )}

      {filteredCompetitions.map(comp => {
        const myRecord = participations[comp.id];
        const isParticipating = myRecord?.status === '참가';
        const isEditing = editingComp?.id === comp.id; 

        return (
          <div key={comp.id} style={{ border: '1px solid #ddd', margin: '15px 0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'relative' }}>
            
            {isEditing ? (
              <form onSubmit={(e) => handleEditSubmit(e, comp.id)} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#007BFF' }}>대회 정보 수정</h4>
                <select value={editingComp.category} onChange={e => setEditingComp({...editingComp, category: e.target.value})} style={{ padding: '8px' }}>
                  <option value="철인3종">1. 철인3종</option>
                  <option value="듀애슬론">2. 듀애슬론</option>
                  <option value="아쿠아슬론">3. 아쿠아슬론</option>
                  <option value="마라톤">4. 마라톤</option>
                  <option value="트레일런">5. 트레일런</option>
                  <option value="수영대회">6. 수영대회</option>
                  <option value="그란폰도">7. 그란폰도</option>
                </select>
                <input value={editingComp.title} onChange={e => setEditingComp({...editingComp, title: e.target.value})} required style={{ padding: '8px' }}/>
                <input type="date" value={editingComp.date} onChange={e => setEditingComp({...editingComp, date: e.target.value})} required style={{ padding: '8px' }}/>
                <input value={editingComp.location} onChange={e => setEditingComp({...editingComp, location: e.target.value})} required style={{ padding: '8px' }}/>
                <input value={editingComp.course} onChange={e => setEditingComp({...editingComp, course: e.target.value})} required style={{ padding: '8px' }}/>
                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                  <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                  <button type="button" onClick={() => setEditingComp(null)} style={{ flex: 1, padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '5px' }}>
                  <button onClick={() => setEditingComp(comp)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', border: '1px solid #ccc', background: '#fff', borderRadius: '4px' }}>수정</button>
                  <button onClick={() => handleDelete(comp.id)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', border: '1px solid #ff4d4f', color: '#ff4d4f', background: '#fff', borderRadius: '4px' }}>삭제</button>
                </div>

                <h3 style={{ margin: '0 0 5px 0', paddingRight: '70px' }}>
                  <span style={{ fontSize: '14px', color: '#fff', backgroundColor: '#e84118', padding: '3px 8px', borderRadius: '4px', marginRight: '8px', verticalAlign: 'middle' }}>
                    {comp.category || '기타'}
                  </span>
                  {comp.title} <span style={{ fontSize: '14px', color: '#666' }}>({comp.course})</span>
                </h3>
                <p style={{ margin: '0 0 15px 0', color: '#555', marginTop: '10px' }}>📅 {comp.date} | 📍 {comp.location}</p>
                
                {!isParticipating ? (
                  <button onClick={() => handleParticipate(comp.id, '참가')} style={{ padding: '10px 20px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%', fontSize: '16px', fontWeight: 'bold' }}>
                    기록등록하기
                  </button>
                ) : (
                  <div style={{ padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '1px solid #cce5ff' }}>
                    <strong style={{ color: '#004085' }}>✅ 기록 등록 활성화 됨</strong>
                    <br/><br/>
                    
                    {myRecord.review && <p style={{ margin: '0 0 15px 0', fontSize: '16px', lineHeight: '1.5' }}>💬 <b>나의 소감:</b><br/> {myRecord.review}</p>}
                    
                    {myRecord.photo_url && (
                        <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                            <img 
                              src={myRecord.photo_url} 
                              alt="인증사진" 
                              onClick={() => setEnlargedImage(myRecord.photo_url)}
                              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '200px', 
                                objectFit: 'contain', 
                                borderRadius: '8px', 
                                display: 'inline-block',
                                cursor: 'zoom-in',
                                transition: 'transform 0.2s ease-in-out'
                              }} 
                            />
                        </div>
                    )}
                    
                    <label style={{ cursor: 'pointer', background: '#28a745', color: '#fff', padding: '10px 15px', borderRadius: '6px', display: 'block', textAlign: 'center', fontWeight: 'bold' }}>
                        📷 사진 및 소감 남기기
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, comp.id)} />
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}

      {enlargedImage && (
        <div 
          onClick={() => setEnlargedImage(null)} 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'zoom-out'
          }}
        >
          <img 
            src={enlargedImage} 
            alt="확대된 사진" 
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} 
          />
        </div>
      )}
    </div>
  );
}

export default App;