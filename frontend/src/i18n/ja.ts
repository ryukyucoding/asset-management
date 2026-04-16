import type { MessageSchema } from './index'

const ja: MessageSchema = {
  common: {
    confirm: '確認',
    cancel: 'キャンセル',
    save: '保存',
    delete: '削除',
    edit: '編集',
    search: '検索',
    loading: '読み込み中...',
    noData: 'データなし',
    success: '成功',
    error: 'エラー',
  },
  nav: {
    assets: '資産カタログ',
    applications: '申請管理',
    notifications: '通知',
    logout: 'ログアウト',
    admin: '管理画面',
  },
  auth: {
    login: 'ログイン',
    logout: 'ログアウト',
    logoutSuccess: 'ログアウトしました',
    register: '登録',
    email: 'メールアドレス',
    password: 'パスワード',
    name: '氏名',
    department: '部署',
    loginTitle: '資産管理システム',
    loginSubtitle: 'アカウントにサインインしてください',
    loginBtn: 'サインイン',
    emailPlaceholder: 'メールアドレスを入力してください',
    passwordPlaceholder: 'パスワードを入力してください',
  },
  asset: {
    name: '資産名',
    serialNo: 'シリアル番号',
    category: 'カテゴリ',
    location: '場所',
    status: 'ステータス',
    description: '説明',
    statusMap: {
      AVAILABLE: '利用可能',
      BORROWED: '貸出中',
      CLAIMED: '払い出し済み',
      RETIRED: '廃棄済み',
    },
  },
  application: {
    type: '申請種別',
    status: 'ステータス',
    returnDate: '返却予定日',
    reason: '申請理由',
    typeMap: {
      BORROW: '貸出',
      CLAIM: '払い出し',
    },
    statusMap: {
      PENDING: '審査中',
      APPROVED: '承認済み',
      REJECTED: '却下',
      RETURNED: '返却済み',
      CANCELLED: 'キャンセル',
    },
  },
}

export default ja
