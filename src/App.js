import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [competitions, setCompetitions] = useState([]);
  const [participations, setParticipations] = useState({});
  const MY_USER_ID = 'user_123'; // 테스트용 유저 ID

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. 대회 목록 가져오기
    const { data: comps } = await supabase.from('competitions').select('*').order('date', { ascending: true });
    setCompetitions(comps || []);

    // 2. 나의 참가 및 기록 정보 가져오기
    const { data: parts } = await supabase.from('participations').select('*').eq('user_id', MY_USER_ID);
    const partsMap = {};
    parts?.forEach(p => partsMap[p.comp_id] = p);
    setParticipations(partsMap);
  };

  // 참가 신청 처리
  const handleParticipate = async (compId, status) => {
    await supabase.from('participations').upsert({ user_id: MY_USER_ID, comp_id: compId, status }, { onConflict: 'user_id, comp_id' });
    fetchData();
  };

  // 사진 업로드 및 기록 저장 로직
  const handleFileUpload = async (e, compId) => {
    const file = e.target.files[0];
    if (!file) return;

    alert('사진을 업로드 중입니다. 잠시만 기다려주세요...');

    // 1. 파일 이름 생성 및 Storage 업로드
    const fileExt = file.name.split('.').pop();
    const fileName = `${MY_USER_ID}_${compId}_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, file);
    
    if (uploadError) {
        console.error(uploadError);
        return alert('업로드 실패!');
    }

    // 2. 업로드된 파일의 Public URL 가져오기
    const { data: publicUrlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    // 3. 임시로 기록(기본값)과 사진 URL을 DB에 업데이트
    const recordTime = prompt("완주 기록을 입력해주세요 (예: 2:30:15) \n※ 사진만 등록하려면 빈칸");
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
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🏊🚴🏃 Tri-Planner 스케줄러</h2>
      
      {competitions.map(comp => {
        const myRecord = participations[comp.id];
        const isParticipating = myRecord?.status === '참가';

        return (
          <div key={comp.id} style={{ border: '1px solid #ccc', margin: '10px 0', padding: '15px' }}>
            <h3>{comp.title} ({comp.course})</h3>
            <p>📅 {comp.date} | 📍 {comp.location}</p>
            
            {!isParticipating ? (
              <button onClick={() => handleParticipate(comp.id, '참가')}>참가 신청하기</button>
            ) : (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f8ff' }}>
                <strong>✅ 참가 신청 완료</strong>
                <br/><br/>
                {/* 기록 및 사진이 있는 경우 표출 */}
                {myRecord.photo_url && (
                    <div>
                        <img src={myRecord.photo_url} alt="인증사진" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }} />
                    </div>
                )}
                {myRecord.record_time && <p>🏆 <b>나의 기록:</b> {myRecord.record_time}</p>}
                
                {/* 사진 업로드 버튼 */}
                <div style={{ marginTop: '10px' }}>
                    <label style={{ cursor: 'pointer', background: '#333', color: '#fff', padding: '5px 10px', borderRadius: '4px' }}>
                        📷 기록 사진 등록하기
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, comp.id)} />
                    </label>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;