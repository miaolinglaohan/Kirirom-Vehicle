const app = getApp()

Page({
  data: {
    form: {
      applicantId: '',
      applicantName: '',
      department: '',
      purpose: '',
      startDate: '',
      startTime: '',
      vehicleId: '',
      vehiclePlate: '',
      driverId: '',
      driverName: '',
      remark: ''
    },
    userList: [],
    applicantIndex: 0,
    vehicleList: [],
    vehicleIndex: -1,
    driverList: [],
    driverIndex: -1,
    departmentList: [],
    departmentIndex: 0,
    submitting: false,
    canApplyForOthers: false
  },

  onLoad() {
    if (!app.globalData.isLogin || !app.globalData.userInfo) {
      wx.showToast({ title: '请先联系管理员登记', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const userRole = app.globalData.userInfo.role
    if (userRole === 'driver') {
      wx.showToast({ title: '专职驾驶员不能申请用车', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    this.setData({
      canApplyForOthers: userRole === 'admin' || userRole === 'approver'
    })

    const now = new Date()
    this.setData({
      'form.startDate': this.formatDate(now),
      'form.startTime': this.formatTime(now)
    })

    this.loadUserList()
    this.loadDepartmentList()
    this.loadVehicleList()
    this.loadDriverList()
  },

  formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  },

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${min}`
  },

  loadUserList() {
    const userInfo = app.globalData.userInfo
    const canApplyForOthers = this.data.canApplyForOthers

    if (!canApplyForOthers) {
      this.setData({
        userList: [userInfo],
        applicantIndex: 0,
        'form.applicantId': userInfo._id,
        'form.applicantName': userInfo.name,
        'form.department': userInfo.department || ''
      })
      this.updateDepartmentIndex(userInfo.department || '')
      return
    }

    wx.cloud.callFunction({ name: 'getUserList' }).then(res => {
      const list = (res.result.data || []).filter(user => user.role !== 'driver')
      this.setData({ userList: list })

      const myId = userInfo._id || userInfo.userId || ''
      const index = list.findIndex(u => u._id === myId)
      if (index >= 0) {
        const userDept = list[index].department || ''
        this.setData({
          applicantIndex: index,
          'form.applicantId': list[index]._id,
          'form.applicantName': list[index].name,
          'form.department': userDept
        })
        this.updateDepartmentIndex(userDept)
      }
    }).catch(err => {
      console.error('获取用户列表失败:', err)
    })
  },

  loadDepartmentList() {
    wx.cloud.callFunction({ name: 'getDepartmentList' }).then(res => {
      const list = res.result.data || []
      const deptNames = list.map(d => d.name)
      this.setData({ departmentList: deptNames })
      this.updateDepartmentIndex(this.data.form.department)
    }).catch(err => {
      console.error('获取部门列表失败:', err)
    })
  },

  updateDepartmentIndex(deptName) {
    if (!deptName) return
    const index = this.data.departmentList.indexOf(deptName)
    if (index >= 0) {
      this.setData({ departmentIndex: index })
    }
  },

  loadVehicleList() {
    wx.cloud.callFunction({ name: 'getVehicleList' }).then(res => {
      const list = res.result.data || []
      list.sort((a, b) => {
        const pa = a.plateNumber || ''
        const pb = b.plateNumber || ''
        return pa.localeCompare(pb, 'zh-CN')
      })

      this.setData({
        vehicleList: list,
        vehicleIndex: -1,
        'form.vehicleId': '',
        'form.vehiclePlate': ''
      })
    }).catch(err => {
      console.error('获取车辆列表失败:', err)
    })
  },

  loadDriverList() {
    wx.cloud.callFunction({ name: 'getDriverList' }).then(res => {
      const list = res.result.data || []
      this.setData({
        driverList: list,
        driverIndex: -1,
        'form.driverId': '',
        'form.driverName': ''
      })
    }).catch(err => {
      console.error('获取驾驶员列表失败:', err)
    })
  },

  onApplicantChange(e) {
    if (!this.data.canApplyForOthers) return

    const index = Number(e.detail.value)
    const user = this.data.userList[index]
    if (!user) return

    const userDept = user.department || ''
    this.setData({
      applicantIndex: index,
      'form.applicantId': user._id,
      'form.applicantName': user.name,
      'form.department': userDept
    })
    this.updateDepartmentIndex(userDept)
  },

  onVehicleChange(e) {
    const index = Number(e.detail.value)
    const vehicle = this.data.vehicleList[index]
    if (!vehicle) return

    this.setData({
      vehicleIndex: index,
      'form.vehicleId': vehicle._id,
      'form.vehiclePlate': vehicle.plateNumber
    })
  },

  onDriverChange(e) {
    const index = Number(e.detail.value)
    const driver = this.data.driverList[index]
    if (!driver) return

    this.setData({
      driverIndex: index,
      'form.driverId': driver._id,
      'form.driverName': driver.name
    })
  },

  onDepartmentChange(e) {
    const index = Number(e.detail.value)
    const dept = this.data.departmentList[index]
    this.setData({
      departmentIndex: index,
      'form.department': dept
    })
  },

  onDateChange(e) {
    this.setData({ 'form.startDate': e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ 'form.startTime': e.detail.value })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  submitForm() {
    const f = this.data.form
    if (!f.applicantId || !f.department || !f.purpose || !f.startDate || !f.startTime || !f.vehicleId || !f.driverId) {
      wx.showToast({ title: '请填写必填项', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    const startTimeStr = `${f.startDate} ${f.startTime}`

    wx.cloud.callFunction({
      name: 'submitApplication',
      data: {
        applicantId: f.applicantId,
        department: f.department,
        purpose: f.purpose,
        startTime: startTimeStr,
        vehicleId: f.vehicleId,
        vehiclePlate: f.vehiclePlate,
        driverId: f.driverId,
        driverName: f.driverName,
        remark: f.remark
      }
    }).then(res => {
      this.setData({ submitting: false })
      if (res.result.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 1500)
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(err => {
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败', icon: 'none' })
      console.error(err)
    })
  }
})
