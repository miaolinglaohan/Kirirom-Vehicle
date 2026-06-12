App({
  globalData: {
    userInfo: null,
    isAdmin: false,
    isApprover: false,
    isLogin: false,
    openid: '',
    loginReady: false  // 新增：标记登录检查是否已完成
  },
  
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        traceUser: true
      })
      this.checkLogin()
    }
  },
  
  checkLogin() {
    wx.cloud.callFunction({
      name: 'login'
    }).then(res => {
      const result = res.result
      this.globalData.loginReady = true  // 标记已完成
      
      if (result.success && result.isRegistered) {
        this.globalData.userInfo = result.userInfo
        this.globalData.isAdmin = result.userInfo.role === 'admin'
        this.globalData.isApprover = result.userInfo.role === 'approver'
        this.globalData.isLogin = true
        this.globalData.openid = result.userInfo.openid || ''
        console.log('登录成功:', result.userInfo.name)
      } else {
        this.globalData.openid = result.openid || ''
        this.globalData.isLogin = false
        console.log('用户未注册')
      }
      
      // 触发回调（如果页面已经设置了）
      if (this.loginCallback) {
        this.loginCallback(result.isRegistered ? result.userInfo : null)
      }
      
    }).catch(err => {
      this.globalData.loginReady = true
      console.error('登录失败:', err)
      if (this.loginCallback) {
        this.loginCallback(null)
      }
    })
  },
  
    // 强制重新检查登录（用于绑定后刷新）
    reCheckLogin() {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'login'
        }).then(res => {
          const result = res.result
          this.globalData.loginReady = true
          
          if (result.success && result.isRegistered) {
            this.globalData.userInfo = result.userInfo
            this.globalData.isAdmin = result.userInfo.role === 'admin'
            this.globalData.isApprover = result.userInfo.role === 'approver'
            this.globalData.isLogin = true
            this.globalData.openid = result.userInfo.openid || ''
          } else {
            this.globalData.openid = result.openid || ''
            this.globalData.isLogin = false
          }
          resolve(result)
        }).catch(err => {
          this.globalData.loginReady = true
          resolve({ success: false })
        })
      })
    }

})