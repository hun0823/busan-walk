# 에셋 출처

| 항목 | 출처 / 라이선스 |
|---|---|
| 캐릭터(보호자, 강아지), 월드 전체 지오메트리 | 직접 제작 — Three.js 기본 도형(구·캡슐·박스·원기둥 등)으로 코드에서 생성 (`js/characters.js`, `js/world.js`) |
| 텍스처(잔디, 포장석, 물결) | 직접 제작 — Canvas 2D로 런타임 절차 생성 |
| 하늘 | 직접 작성한 그라디언트 셰이더 |
| 물소리 | 직접 제작 — WebAudio 브라운 노이즈 + 저역 필터 + LFO 합성 (`js/sound.js`), 음원 파일 없음 |
| Three.js (`vendor/three.module.js`, `vendor/three.core.js`) | three npm 패키지, MIT License (© three.js authors) |
| 210LAB 로고 (`assets/210lab-logo-clean.png`) | 210LAB 브랜드 자료 |

산사(sansatemple.com)의 코드·모델·텍스처·음원은 사용하지 않았다.
월드 배치는 아래 "월드 v3 (OSM)" 참고.

## 캐릭터 v2 (2026-11-01)
- 보호자·강아지: Three.js 기본 도형(Sphere/Capsule/Torus/Cylinder/Cone)으로 직접 제작. 외부 모델 없음.
- 강아지 털: 구 정점을 사인 노이즈로 부풀린 연속 표면(puffGeo) + 캔버스로 직접 그린 곱슬 범프 텍스처(furBump). 외부 텍스처 없음.
- 재질: MeshStandardMaterial(roughness 0.9~1, metalness 0) + onBeforeCompile 프레넬 림라이트(직접 작성).
- 캐릭터 보조 라이트: 약한 PointLight 1개(카메라-캐릭터 사이).

## 월드 v3 — OpenStreetMap 실측 기반 (2026-11-01)
- 출처: OpenStreetMap (bukhang/real/osm-*.geojson, 2026-11-01 다운로드). 라이선스: ODbL 1.0. 화면 크레딧 "Map data © OpenStreetMap contributors (ODbL)".
- 가공: tools/build_world.py (shapely) — 공원 중심(35.108897, 129.044595) 기준 로컬 미터 투영 → Douglas-Peucker 단순화, 0.5m 반올림 → 해안선+bbox 폴리곤화로 육지 판정 → data/bukhang.json(약 70KB) 한 파일로 번들. 파생 데이터베이스이므로 ODbL 적용.
- 축척: 수평 0.4배(js/world.js `S`). 이동 속도·카메라 far·안개·그림자 범위 조정.
- 실측 위치: 공원 경계, 경관수로, 보행로/도로, 다리 외곽, 건물 footprint, 해안선, OSM 나무 포인트.
- 연출: 건물 높이·색·창문, 경로 따라 배치한 나무·가로등, 다리 난간·디테일, 억새, 먼 바다 다리·섬 실루엣, '조망언덕·야생화단지' 라벨 위치.
- 지도 서비스 이미지(로드뷰·위성·네이버·카카오) 및 외부 모델/텍스처 미사용. 텍스처는 모두 절차 생성.
- v3.2: 북동 부두·운하 동쪽·남쪽 부두 육지는 map.osm의 natural=coastline(좌측=육지 규칙)과 man_made=pier/quay에서 생성. 손그림 부두 윤곽 삭제. 잔디 클로버·풀잎 질감과 풀포기 인스턴스는 절차 생성(연출). 탑뷰 보행로 띠는 실제보다 넓게 그린 지도 표현.
- v3.3: 물고기 떼(수로·바다, InstancedMesh 2개)·수로 상어 1마리(둥근 귀여운 형태)·항만 크레인·정박선은 모두 직접 만든 기본 도형(구·원뿔·상자)으로 만든 연출. 위치는 OSM 해안선(map.osm) 안벽 근처에 자동 배치. 바다는 반투명+깊은 바닥면으로 물고기가 비쳐 보이게 함.
