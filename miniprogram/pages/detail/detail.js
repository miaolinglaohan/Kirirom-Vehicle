const app = getApp()

Page({
  data: {
    detail: {},
    statusText: {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
      returned: '已归还'
    },
    canReturn: false,
    returnDate: '',
    returnTime: '',
    userId: '',
    userRole: '',
    recordId: ''
  },

  onLoad(options) {
    const id = options.id
    this.setData({ recordId: id })
    
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({ 
        userId: userInfo._id || userInfo.userId || '',
        userRole: userInfo.role
      })
      this.loadDetail(id)
    } else {
      app.loginCallback = () => {
        const info = app.globalData.userInfo
        this.setData({ 
          userId: info._id || info.userId || '',
          userRole: info.role
        })
        this.loadDetail(id)
      }
    }
    
    const now = new Date()
    this.setData({
      returnDate: this.formatDate(now),
      returnTime: this.formatTime(now)
    })
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = (date.getMonth() + 1).toString().padStart(2, '0')
    const d = date.getDate().toString().padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0')
    const min = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${min}`
  },

  loadDetail(id) {
    wx.showLoading({ title: '加载中' })
    
    wx.cloud.callFunction({
      name: 'getApplicationDetail',
      data: { id }
    }).then(res => {
      wx.hideLoading()
      const result = res.result

      if (!result || result.code !== 0) {
        wx.showToast({ title: result?.message || '加载详情失败', icon: 'none' })
        return
      }

      const detail = result.data
      
      const userId = this.data.userId
      const userRole = this.data.userRole
      
      // 权限判断：申请人、管理员、审批人角色可归还
      const isAdmin = userRole === 'admin'
      const isApproverRole = userRole === 'approver'
      const isApplicant = detail.applicantId === userId
      
      const canReturn = (isAdmin || isApproverRole || isApplicant) && 
                        detail.status === 'approved' && 
                        !detail.endTime
      
      this.setData({ detail, canReturn })
    }).catch(err => {
      wx.hideLoading()
      console.error('获取详情失败:', err)
      wx.showToast({ title: '加载详情失败', icon: 'none' })
    })
  },

  onReturnDateChange(e) {
    this.setData({ returnDate: e.detail.value })
  },

  onReturnTimeChange(e) {
    this.setData({ returnTime: e.detail.value })
  },

  submitReturn() {
    const { returnDate, returnTime, recordId } = this.data
    if (!returnDate || !returnTime) {
      wx.showToast({ title: '请选择完整时间', icon: 'none' })
      return
    }
    
    const endTimeStr = `${returnDate} ${returnTime}`
    
    wx.showLoading({ title: '提交中' })
    wx.cloud.callFunction({
      name: 'returnVehicle',
      data: { id: recordId, endTime: endTimeStr }  // 传 id，云函数已兼容
    }).then(res => {
      wx.hideLoading()
      
      // 关键修复：判断云函数返回结果
      if (res.result && res.result.success) {
        wx.showToast({ title: '归还登记成功', icon: 'success' })
        // 延迟刷新，确保数据库同步
        setTimeout(() => this.loadDetail(recordId), 500)
      } else {
        wx.showToast({ 
          title: res.result?.message || '归还失败', 
          icon: 'none' 
        })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '网络错误，归还失败', icon: 'none' })
      console.error(err)
    })
  }
})
