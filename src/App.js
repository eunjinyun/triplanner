import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [competitions, setCompetitions] = useState([]);
  const [participations, setParticipations] = useState({});
  // 카테고리 기본값을 '철인3종'으로 세팅
  const [newComp, setNewComp] = useState({ title: '', date: '', location: '', course: '', category: '철인3종' });
  const MY_USER_ID = 'user_123'; 

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: comps } = await supabase.from('competitions').select('*').order('date', { ascending: true });
    setCompetitions(comps || []);

    const { data: parts } = await supabase.from('participations').select('*').eq('user_id', MY_USER_ID);
    const partsMap = {};
    parts?.forEach(p => partsMap[p.comp_id] = p);
    setParticipations(partsMap);
  };

  const handleAddCompetition = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('competitions').insert([newComp]);
    if (error) alert('등록 실패!');
    else {
      alert('대회가 등록되었습니다.');
      setNewComp({ title: '', date: '', location: '', course: '', category: '철인3종' });
      fetchData(); 
    }
  };

  const handleParticipate = async (compId, status) => {
    await supabase.from('participations').upsert({ user_id: MY_USER_ID, comp_id: compId, status }, { onConflict: 'user_id, comp_id' });
    fetchData();
  };

  const handleFileUpload = async (e, compId) => {
    const file = e.target.files[0];
    if (!file) return;

    alert('사진을 업로드 중입니다. 잠시만 기다려주세요...');
    const fileExt = file.name.split('.').pop();
    const fileName = `${MY_USER_ID}_${compId}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
    if (uploadError) return alert('업로드 실패!');

    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    // 질문 텍스트 변경 및 review(소감) 변수에 저장
    const reviewText = prompt("대회후기 소감을 간략하게 남겨주세요 \n※ 사진만 등록하려면 빈칸으로 두세요");
    
    await supabase.from('participations').upsert({
      user_id: MY_USER_ID,
      comp_id: compId,
      status: '참가',
      review: reviewText || null,
      photo_url: photoUrl
    }, { onConflict: 'user_id, comp_id' });

    alert('사진과 소감이 등록되었습니다!');
    fetchData();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>🏊🚴🏃 Tri-Planner 스케줄러</h2>
      
      <form onSubmit={handleAddCompetition} style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>[관리자] 대회 수동 등록</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* 카테고리 선택 드롭다운 폼 추가 */}
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

      {competitions.map(comp => {
        const myRecord = participations[comp.id];
        const isParticipating = myRecord?.status === '참가';

        return (
          <div key={comp.id} style={{ border: '1px solid #ddd', margin: '15px 0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            {/* 대회 제목 앞에 [카테고리] 배지 추가 */}
            <h3 style={{ margin: '0 0 5px 0' }}>
              <span style={{ fontSize: '14px', color: '#fff', backgroundColor: '#e84118', padding: '3px 8px', borderRadius: '4px', marginRight: '8px', verticalAlign: 'middle' }}>
                {comp.category || '기타'}
              </span>
              {comp.title} <span style={{ fontSize: '14px', color: '#666' }}>({comp.course})</span>
            </h3>
            <p style={{ margin: '0 0 15px 0', color: '#555', marginTop: '10px' }}>📅 {comp.date} | 📍 {comp.location}</p>
            
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
                
                {/* 기존 기록 표출 대신 '소감' 표출로 변경 */}
                {myRecord.review && <p style={{ margin: '0 0 15px 0', fontSize: '16px', lineHeight: '1.5' }}>💬 <b>나의 소감:</b><br/> {myRecord.review}</p>}
                
                <label style={{ cursor: 'pointer', background: '#28a745', color: '#fff', padding: '10px 15px', borderRadius: '6px', display: 'block', textAlign: 'center', fontWeight: 'bold' }}>
                    📷 사진 및 소감 남기기
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