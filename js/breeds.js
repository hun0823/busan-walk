// 견종 데이터(데이터 주도). 견종 추가 = 이 배열에 객체 하나 추가. 모델은 characters.js makeDog(breed)가 파라미터로 생성.
// 출처: 디자이너 표 breeds.md (AI 생성 시안 기반, 색은 추정값) → 연출. 실제 견종 표준과 다를 수 있음.
// color: 주 털색, color2: 보조색, color3: 셋째 색(안장 등)
// 무늬 플래그: face(주둥이·볼 보조색) chest(가슴 보조색) mask(주둥이 진한 보조색) earCol(귀 보조색) head(머리 전체 보조색) saddle(등 안장 color3) tailTip(꼬리 끝 색)
// ear: drop(처짐)|erect(선 삼각)|bat(큰 박쥐)|button(앞으로 접힌 단추)|semi(반쯤 선, 끝 접힘)|big(아주 큰 선 귀), earSize 배율
// tail: curl(등 위 말림)|ring(고리)|plume(등 위 깃털)|down(아래 깃털)|straight(위로 선)|otter(굵은 직선)|stub(뭉툭)|pom(폼폼)|sickle(가는 낫)
// 얼굴 플래그(v3.6): brows(눈썹 점 색) cheeks(볼 흰털) blaze(이마 흰 줄) smile(혀) curls(곱슬 구슬) earIn(귀 안쪽 색) pawCol(발 색)
// muzzle: 길이 배율(0.4 납작 ~ 1.8 김), body: 몸 길이, leg: 다리 길이, head: 머리 크기, girth: 몸통 굵기, size: 전체, fluff: 털 몽글함 0~1, ruff: 목 갈기
export const DEFAULT_BREED = 'bichon';
export const BREEDS = [
  { id: 'husky', brows: '#F3E9DC', earIn: '#F3E9DC', name: '허스키', color: '#7F7570', color2: '#F3E9DC', face: 1, chest: 1, eye: '#3E5F80', ear: 'erect', tail: 'curl', tailTip: '#F3E9DC', muzzle: 1.2, leg: 1.15, size: 1.05, fluff: .3 },
  { id: 'jindo', earIn: '#F5D9AE', name: '진돗개', color: '#ECA85A', color2: '#F5D9AE', face: 1, chest: 1, ear: 'erect', earSize: .85, tail: 'curl', muzzle: 1.15, leg: 1.1, fluff: .15 },
  { id: 'poodle', curls: 1, name: '푸들', color: '#CF7D34', color2: '#A46323', ear: 'drop', earSize: 1.1, tail: 'pom', muzzle: .9, leg: 1.15, fluff: 1 },
  { id: 'bichon', name: '비숑', color: '#F7EDE1', color2: '#E3D5C8', ear: 'drop', tail: 'plume', muzzle: .8, head: 1.1, fluff: 1 },
  { id: 'maltese', name: '말티즈', color: '#FBEDE0', color2: '#E2D1BF', ear: 'drop', earSize: 1.35, tail: 'plume', muzzle: .8, size: .9, leg: .9, fluff: .55, topknot: '#F07A2A' },
  { id: 'shihtzu', name: '시츄', color: '#F3E6D0', color2: '#D9A060', earCol: '#5A4030', ear: 'drop', earSize: 1.3, tail: 'plume', muzzle: .45, leg: .8, girth: 1.1, fluff: .7, eyePatch: 1 },
  { id: 'pomeranian', name: '포메라니안', color: '#F09538', color2: '#F9CF94', chest: 1, ear: 'erect', earSize: .6, tail: 'plume', muzzle: .6, size: .85, leg: .75, girth: 1.2, fluff: 1, ruff: 1 },
  { id: 'golden', smile: 1, name: '골든리트리버', color: '#F0B468', color2: '#E39E55', earCol: '#E39E55', ear: 'drop', earSize: 1.1, tail: 'down', muzzle: 1.4, size: 1.2, leg: 1.2, body: 1.15, fluff: .4 },
  { id: 'frenchie', name: '프렌치불독', color: '#F6C489', color2: '#3E3226', mask: 1, ear: 'bat', earSize: 1.2, tail: 'stub', muzzle: .4, size: .95, leg: .85, girth: 1.3, fluff: 0 },
  { id: 'corgi', blaze: 1, name: '웰시코기', color: '#E68729', color2: '#F3E5CF', face: 1, chest: 1, ear: 'big', earSize: 1.1, tail: 'stub', muzzle: 1.1, body: 1.3, leg: .6, girth: 1.1, fluff: .2 },
  { id: 'beagle', blaze: 1, name: '비글', color: '#E18B36', color2: '#F3E6D0', color3: '#3C2C1C', face: 1, chest: 1, saddle: 1, ear: 'drop', earSize: 1.3, tail: 'straight', tailTip: '#F3E6D0', muzzle: 1.15, fluff: 0 },
  { id: 'dachshund', brows: '#D9832E', pawCol: '#D9832E', name: '닥스훈트', color: '#271E15', color2: '#D9832E', face: 1, ear: 'drop', earSize: 1.25, tail: 'straight', muzzle: 1.6, body: 1.6, leg: .5, head: .85, fluff: 0 },
  { id: 'shiba', cheeks: 1, brows: '#F3E3CC', smile: 1, earIn: '#F3E3CC', name: '시바견', color: '#D8763A', color2: '#F3E3CC', face: 1, chest: 1, ear: 'erect', earSize: .75, tail: 'ring', muzzle: 1.0, size: .95, fluff: .15 }, // 시안보다 덜 붉게 조정
  { id: 'samoyed', name: '사모예드', color: '#F8E7D0', color2: '#E9D6BE', ear: 'erect', earSize: .7, tail: 'plume', muzzle: 1.15, size: 1.15, leg: 1.1, girth: 1.15, fluff: 1, ruff: 1, smile: 1 },
  { id: 'yorkshire', name: '요크셔테리어', color: '#786E6C', color2: '#F0B878', head: .95, headCol: 1, ear: 'erect', earSize: .7, tail: 'straight', muzzle: .75, size: .8, leg: .85, fluff: .5 },
  { id: 'chihuahua', name: '치와와', color: '#F7C280', color2: '#FDD5A2', ear: 'big', earSize: 1.45, tail: 'sickle', muzzle: .45, size: .75, leg: .95, girth: .8, head: 1.12, fluff: 0 },
  { id: 'bordercollie', blaze: 1, name: '보더콜리', color: '#271E17', color2: '#F0E4D2', face: 1, chest: 1, ear: 'semi', tail: 'down', tailTip: '#F0E4D2', muzzle: 1.25, size: 1.05, leg: 1.1, fluff: .45, ruff: .6 },
  { id: 'pug', name: '퍼그', color: '#F5C68A', color2: '#32251C', mask: 1, earCol: '#32251C', ear: 'button', tail: 'ring', muzzle: .4, size: .95, leg: .8, girth: 1.25, fluff: 0 },
  { id: 'labrador', name: '래브라도리트리버', color: '#2A2622', color2: '#3E3933', ear: 'drop', tail: 'otter', muzzle: 1.35, size: 1.15, leg: 1.15, body: 1.1, girth: 1.1, fluff: 0 },
  { id: 'spitz', name: '스피츠', color: '#FDF3E7', color2: '#DECBBA', ear: 'erect', earSize: .65, tail: 'plume', muzzle: .85, size: .9, leg: .95, girth: .9, fluff: .8, ruff: .5 },
];
export const breedById = id => BREEDS.find(b => b.id === id) || BREEDS.find(b => b.id === DEFAULT_BREED);
