const app = getApp()

Page({
  data: {
    userName: '未登录',
    userRole: 'user',
    userId: '',
    isLogin: false,
    openid: '',
    currentFilter: 'all',
    records: [],
    statusText: {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
      returned: '已归还'
    },
    
    // 分页相关
    page: 1,
    pageSize: 5,
    hasMore: false,
    isLoading: false
  },

  onLoad() {
    this.tryLogin()
  },

  onShow() {
    if (!app.globalData.isLogin && app.globalData.openid) {
      app.reCheckLogin().then(result => {
        if (result.success && result.isRegistered) {
          this.setUserInfo(result.userInfo)
          this.refreshList()
        }
      })
      return
    }
    if (this.data.userId) {
      this.refreshList()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshList()
    wx.stopPullDownRefresh()
  },

  // 触底加载更多（手指滑到页面最底部自动触发）
  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMore()
    }
  },

  tryLogin() {
    if (app.globalData.loginReady) {
      if (app.globalData.userInfo) {
        this.setUserInfo(app.globalData.userInfo)
        this.refreshList()
      } else {
        this.setData({ 
          userName: '未登记', 
          isLogin: false,
          openid: app.globalData.openid || ''
        })
      }
      return
    }
    app.loginCallback = (userInfo) => {
      if (userInfo) {
        this.setUserInfo(userInfo)
        this.refreshList()
      } else {
        this.setData({ 
          userName: '未登记', 
          isLogin: false,
          openid: app.globalData.openid || ''
        })
      }
    }
  },

  setUserInfo(userInfo) {
    if (!userInfo) return
    this.setData({
      userName: userInfo.name || '用户',
      userRole: userInfo.role || 'user',
      userId: userInfo._id || '',
      isLogin: true
    })
  },

  copyOpenid() {
    if (!this.data.openid) return
    wx.setClipboardData({
      data: this.data.openid,
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    })
  },

  // 刷新列表（重置到第1页）
  refreshList() {
    this.setData({ page: 1, hasMore: false, records: [], isLoading: true })
    this.fetchRecords()
  },

  // 加载更多（下一页）
  loadMore() {
    if (!this.data.hasMore || this.data.isLoading) return
    this.setData({ page: this.data.page + 1 })
    this.fetchRecords(true)
  },

  // 核心查询方法
  fetchRecords(isLoadMore = false) {
    this.setData({ isLoading: true })
    
    let params = {
      page: this.data.page,
      pageSize: this.data.pageSize
    }
    
    if (this.data.currentFilter === 'pending') {
      params.filter = { status: 'pending' }
    } else if (this.data.currentFilter === 'approved') {
      // 云函数会把 approved 扩展为 approved 和 returned
      params.filter = { status: 'approved' }
    } else if (this.data.currentFilter === 'my') {
      params.type = 'my'
      params.applicantId = this.data.userId
    }
    
    wx.cloud.callFunction({
      name: 'getApplications',
      data: params,
      timeout: 10000
    }).then(res => {
      this.setData({ isLoading: false })
      const result = res.result
      
      if (!result || !result.success) {
        wx.showToast({ title: result?.message || '加载失败', icon: 'none' })
        return
      }
      
      const newRecords = isLoadMore 
        ? [...this.data.records, ...result.data] 
        : result.data
      
      this.setData({
        records: newRecords,
        hasMore: result.hasMore
      })
    }).catch(err => {
      this.setData({ isLoading: false })
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  switchFilter(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ currentFilter: type }, () => {
      this.refreshList()
    })
  },

  goApply() {
    if (!this.data.isLogin) {
      wx.showToast({ title: '请先联系管理员登记', icon: 'none' })
      return
    }
    if (this.data.userRole === 'driver') {
      wx.showToast({ title: '专职驾驶员不能申请用车', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/apply/apply' })
  },

  goApprove() {
    if (!app.globalData.isAdmin && !app.globalData.isApprover) {
      wx.showToast({ title: '仅审批人和管理员可进入', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/approve/approve' })
  },

  goAdmin() {
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '无权限访问后台', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  }
})
