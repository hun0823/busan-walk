// 공용 서버 설정. SERVER_URL 이 비어 있으면 서버에 붙지 않고 기존처럼 혼자 플레이.
// 예: 'wss://busan-walk-server.fly.dev'  (로컬 테스트는 주소 뒤 ?server=ws://127.0.0.1:8787 로 덮어쓸 수 있음)
export const SERVER_URL = 'wss://168-138-207-187.sslip.io';
export const NET = { sendHz: 10, connectTimeoutMs: 3000, maxDetailPhone: 6, maxDetailDesktop: 12, retryMaxMs: 15000 };
