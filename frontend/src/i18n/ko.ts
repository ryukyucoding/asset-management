import type { MessageSchema } from './index'

const ko: MessageSchema = {
  common: {
    confirm: '확인',
    cancel: '취소',
    save: '저장',
    delete: '삭제',
    edit: '편집',
    search: '검색',
    loading: '로딩 중...',
    noData: '데이터 없음',
    success: '성공',
    error: '오류',
  },
  nav: {
    assets: '자산 목록',
    applications: '신청 관리',
    notifications: '알림',
    logout: '로그아웃',
    admin: '관리자',
  },
  auth: {
    login: '로그인',
    logout: '로그아웃',
    logoutSuccess: '로그아웃되었습니다',
    register: '회원가입',
    email: '이메일',
    password: '비밀번호',
    name: '이름',
    department: '부서',
    loginTitle: '자산 관리 시스템',
    loginSubtitle: '계정에 로그인하세요',
    loginBtn: '로그인',
    emailPlaceholder: '이메일을 입력하세요',
    passwordPlaceholder: '비밀번호를 입력하세요',
  },
  asset: {
    name: '자산명',
    serialNo: '일련번호',
    category: '카테고리',
    location: '위치',
    status: '상태',
    description: '설명',
    statusMap: {
      AVAILABLE: '사용 가능',
      BORROWED: '대출 중',
      CLAIMED: '불출 완료',
      RETIRED: '폐기',
    },
  },
  application: {
    type: '신청 유형',
    status: '상태',
    returnDate: '반납 예정일',
    reason: '신청 사유',
    typeMap: {
      BORROW: '대출',
      CLAIM: '불출',
    },
    statusMap: {
      PENDING: '검토 중',
      APPROVED: '승인됨',
      REJECTED: '반려됨',
      RETURNED: '반납 완료',
      CANCELLED: '취소됨',
    },
  },
}

export default ko
