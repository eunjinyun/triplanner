import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [competitions, setCompetitions] = useState([]);
  const [participations, setParticipations] = useState({});
  const [newComp, setNewComp] = useState({ title: '', date: '', location: '', course: '' });
  const MY_USER_ID = 'user_123'; // 테스트용 유저 ID

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 대회 목록 가져오기
    const { data: comps } = await supabase.from('competitions').select('*').order('date', { ascending: true });
    setCompetitions(comps || []);

    // 나의 참가 기록 가져오기
    const { data: parts } = await supabase.from('participations').select('*').eq('user_id', MY_USER_ID);
    const partsMap = {};
    parts?.forEach(p => partsMap[p.comp_id] = p);
    setParticipations(partsMap);
  };

  // [관리자] 대회 등록 기능
  const handleAddCompetition = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('competitions').insert([newComp]);
    if (error) alert('등록 실패!');
    else {
      alert('대회가 등록되었습니다.');
      setNewComp({ title: '', date: '', location: '', course: '' });
      fetchData(); // 등록 후 목록 새로고침
    }
  };

  // 참가 신청 기능
  const handleParticipate = async (compId, status) => {
    await supabase.from('participations').upsert({ user_id: MY_USER_ID, comp_id: compId, status }, { onConflict: 'user_id, comp_id' });
    fetchData();
  };

  // 사진 및 기록 업로드 기능
  const handleFileUpload = async (e, compId) => {
    const file = e.target.files[0];
    if (!file) return;

    alert('사진을 업로드 중입니다. 잠시만 기다려주세요...');
    const fileExt = file.name.split('.').pop();
    const fileName = `${MY_USER_ID}_${compId}_${Date.now()}.${fileExt}`;
    
    // 1. 스토리지에 사진 올리기
    const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
    if (uploadError) return alert('업로드 실패! Supabase Storage 설정을 확인하세요.');

    // 2. 사진 주소 가져오기
    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    // 3. 기록 입력받고 DB에 저장
    const recordTime = prompt("완주 기록을 입력해주세요 (예: 2:30:15) \n※ 사진만 등록하려면 빈칸으로 두세요");
    await supabase.from('participations').upsert({
      user_id: MY_USER_ID,
      comp_id: compId,
      status: '참가',
      record_time: recordTime || null,
      photo_url: photoUrl
    }, { onConflict: 'user_id, comp_id' });

    alert('기록과 사진이 등록되었습니다!');
    fetchData();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>🏊🚴🏃 Tri-Planner 스케줄러</h2>
      
      {/* 관리자 대회 등록 폼 (이 부분이 없어서 빈 화면처럼 보였던 것입니다!) */}
      <form onSubmit={handleAddCompetition} style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>[관리자] 대회 수동 등록</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input placeholder="대회명 (예: 통영 트라이애슬론)" value={newComp.title} onChange={e => setNewComp({...newComp, title: e.target.value})} required style={{ padding: '8px' }}/>
          <input type="date" value={newComp.date} onChange={e => setNewComp({...newComp, date: e.target.value})} required style={{ padding: '8px' }}/>
          <input placeholder="장소 (예: 경남 통영)" value={newComp.location} onChange={e => setNewComp({...newComp, location: e.target.value})} required style={{ padding: '8px' }}/>
          <input placeholder="코스 (예: 올림픽)" value={newComp.course} onChange={e => setNewComp({...newComp, course: e.target.value})} required style={{ padding: '8px' }}/>
          <button type="submit" style={{ padding: '10px', backgroundColor: '#333', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>새로운 대회 등록하기</button>
        </div>
      </form>

      {/* 대회 목록이 없을 때 안내 문구 */}
      {competitions.length === 0 && (
          <p style={{ textAlign: 'center', color: '#888' }}>현재 등록된 대회가 없습니다. 위에서 대회를 등록해 보세요!</p>
      )}

      {/* 대회 리스트 및 참가 기능 */}
      {competitions.map(comp => {
        const myRecord = participations[comp.id];
        const isParticipating = myRecord?.status === '참가';

        return (
          <div key={comp.id} style={{ border: '1px solid #ddd', margin: '15px 0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 5px 0' }}>{comp.title} <span style={{ fontSize: '14px', color: '#666' }}>({comp.course})</span></h3>
            <p style={{ margin: '0 0 15px 0', color: '#555' }}>📅 {comp.date} | 📍 {comp.location}</p>
            
            {!isParticipating ? (
              <button onClick={() => handleParticipate(comp.id, '참가')} style={{ padding: '10px 20px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%', fontSize: '16px', fontWeight: 'bold' }}>
                참가 신청하기
              </button>
            ) : (
              <div style={{ padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '1px solid #cce5ff' }}>
                <strong style={{ color: '#004085' }}>✅ 참가 신청 완료</strong>
                <br/><br/>
                
                {myRecord.photo_url && (
                    <div style={{ marginBottom: '15px' }}>
                        <img src={myRecord.photo_url} alt="인증사진" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', display: 'block' }} />
                    </div>
                )}
                {myRecord.record_time && <p style={{ margin: '0 0 15px 0', fontSize: '18px' }}>🏆 <b>나의 기록:</b> {myRecord.record_time}</p>}
                
                <label style={{ cursor: 'pointer', background: '#28a745', color: '#fff', padding: '10px 15px', borderRadius: '6px', display: 'block', textAlign: 'center', fontWeight: 'bold' }}>
                    📷 사진 및 기록 업로드
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, comp.id)} />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;