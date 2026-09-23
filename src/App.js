import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

function App() {
  const [competitions, setCompetitions] = useState([]);
  const [participations, setParticipations] = useState({});
  const [newComp, setNewComp] = useState({ title: '', date: '', location: '', course: '', category: '철인3종' });
  
  // 새로 추가된 상태(State) 변수들
  const [selectedYear, setSelectedYear] = useState('전체'); // 년도 필터용
  const [editingComp, setEditingComp] = useState(null); // 수정 모드 추적용
  
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

  // 1. [관리자] 대회 등록 기능
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

  // 2. [관리자] 대회 삭제 기능
  const handleDelete = async (compId) => {
    if (!window.confirm('정말로 이 대회를 삭제하시겠습니까?\n(등록된 참가 기록과 후기도 모두 삭제됩니다)')) return;

    // 참가 기록을 먼저 지워야 참조 에러(FK)가 나지 않음
    await supabase.from('participations').delete().eq('comp_id', compId);
    
    // 대회 삭제
    const { error } = await supabase.from('competitions').delete().eq('id', compId);
    if (error) alert('삭제 중 오류가 발생했습니다.');
    else {
      alert('대회가 삭제되었습니다.');
      fetchData();
    }
  };

  // 3. [관리자] 대회 수정 저장 기능
  const handleEditSubmit = async (e, compId) => {
    e.preventDefault();
    const { error } = await supabase.from('competitions').update({
      title: editingComp.title,
      date: editingComp.date,
      location: editingComp.location,
      course: editingComp.course,
      category: editingComp.category
    }).eq('id', compId);

    if (error) alert('수정 실패!');
    else {
      alert('대회 정보가 수정되었습니다.');
      setEditingComp(null); // 수정 모드 종료
      fetchData();
    }
  };

  // 4. 일반 참가 기능 및 사진 업로드
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

  // 존재하는 년도만 뽑아서 배열로 만들기 (ex: ['전체', '2026', '2025'])
  const availableYears = ['전체', ...new Set(competitions.map(comp => comp.date.substring(0, 4)))].sort((a, b) => b - a);
  
  // 선택된 년도에 맞게 리스트 필터링
  const filteredCompetitions = selectedYear === '전체' 
    ? competitions 
    : competitions.filter(comp => comp.date.startsWith(selectedYear));

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>🏊🚴🏃 Tri-Planner 스케줄러</h2>
      
      {/* --- 상단: 관리자 수동 등록 폼 --- */}
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

      {/* --- 중단: 년도별 필터 드롭다운 --- */}
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

      {/* --- 하단: 대회 목록 렌더링 --- */}
      {filteredCompetitions.map(comp => {
        const myRecord = participations[comp.id];
        const isParticipating = myRecord?.status === '참가';
        const isEditing = editingComp?.id === comp.id; // 현재 이 항목이 수정 모드인지 확인

        return (
          <div key={comp.id} style={{ border: '1px solid #ddd', margin: '15px 0', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', position: 'relative' }}>
            
            {/* 수정 모드일 때 보여줄 UI */}
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
              /* 일반 모드일 때 보여줄 UI */
              <>
                {/* 관리자용 수정/삭제 버튼 (우측 상단) */}
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
                    
                    {myRecord.review && <p style={{ margin: '0 0 15px 0', fontSize: '16px', lineHeight: '1.5' }}>💬 <b>나의 소감:</b><br/> {myRecord.review}</p>}
                    
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
    </div>
  );
}

export default App;