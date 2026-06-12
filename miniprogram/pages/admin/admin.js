const app = getApp()
Page({
  data: {
    currentTab: 0,
    userList: [],
    vehicleList: [],
    recordList: [],
    roleText: {
      user: '普通用户',
      approver: '审批人',
      admin: '管理员',
      driver: '驾驶员'
    },
    statusText: {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
      returned: '已归还'
    },
    departmentList: ['项目部', '分公司', '综合部', '运检部', '枢纽部', '安全部', '财务部', '其他'],
    roleList: [
      { name: '普通用户', value: 'user' },
      { name: '审批人', value: 'approver' },
      { name: '管理员', value: 'admin' },
      { name: '驾驶员', value: 'driver' }
    ],
    vehicleTypeList: ['皮卡', 'SUV', '轿车', '面包车', '其他'],
    
    showUserModal: false,
    isEditMode: false,
    editUserId: '',
    newUser: { name: '', department: '', role: '', roleName: '', openid: '' },
    newUserDeptIndex: 0,
    newUserRoleIndex: 0,
    
    showVehicleModal: false,
    newVehicle: { plateNumber: '', type: '' },
    newVehicleTypeIndex: 0,
    currentOpenid: '',
    
    // 记录管理分页
    recordPage: 1,
    recordPageSize: 5,
    recordHasMore: true,
    recordIsLoading: false,
    exportFileList: [],
    exportFileIsLoading: false,

    showRecordModal: false,
    editRecordId: '',
    editRecordVehicleIndex: -1,
    editRecord: {
      vehicleId: '',
      vehiclePlate: '',
      purpose: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      status: ''
    }
  },

  onLoad() {
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '无权限访问', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    
    this.setData({ currentOpenid: app.globalData.openid || '' })
    this.loadUsers()
    this.loadVehicles()
    this.loadRecords()
    this.loadExportFiles()
  },

  switchTab(e) {
    this.setData({ currentTab: parseInt(e.currentTarget.dataset.index) })
  },

  // 触底加载更多记录
  onReachBottom() {
    if (this.data.currentTab === 0) {  // 只在"记录管理"标签触底加载
      this.loadMoreRecords()
    }
  },

  loadUsers() {
    wx.showLoading({ title: '加载中' })
    wx.cloud.callFunction({ name: 'adminGetUsers' }).then(res => {
      wx.hideLoading()
      this.setData({ userList: res.result.data || [] })
    }).catch(err => {
      wx.hideLoading()
      console.error(err)
    })
  },

  loadVehicles() {
    wx.cloud.callFunction({ name: 'adminGetVehicles' }).then(res => {
      this.setData({ vehicleList: res.result.data || [] })
    }).catch(err => {
      console.error(err)
    })
  },

  // 分页加载记录
  loadRecords(isLoadMore = false) {
    if (this.data.recordIsLoading) return
    this.setData({ recordIsLoading: true })
    
    const page = isLoadMore ? this.data.recordPage + 1 : 1
    
    wx.cloud.callFunction({
      name: 'getApplications',
      data: {
        page: page,
        pageSize: this.data.recordPageSize
      }
    }).then(res => {
      this.setData({ recordIsLoading: false })
      const result = res.result
      
      if (result && result.success) {
        const newList = isLoadMore 
          ? [...this.data.recordList, ...result.data] 
          : result.data
        
        this.setData({
          recordList: newList,
          recordPage: page,
          recordHasMore: result.hasMore
        })
      }
    }).catch(err => {
      this.setData({ recordIsLoading: false })
      console.error(err)
    })
  },

  // 刷新记录（重置到第1页）
  refreshRecords() {
    this.loadRecords(false)
  },

  // 触底加载更多
  loadMoreRecords() {
    if (this.data.recordHasMore && !this.data.recordIsLoading) {
      this.loadRecords(true)
    }
  },

  formatFileTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (isNaN(date.getTime())) return ''
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  loadExportFiles() {
    if (this.data.exportFileIsLoading) return
    this.setData({ exportFileIsLoading: true })

    wx.cloud.callFunction({
      name: 'adminListExportFiles'
    }).then(res => {
      const result = res.result
      this.setData({ exportFileIsLoading: false })

      if (!result || !result.success) {
        wx.showToast({ title: result?.message || '加载文件失败', icon: 'none' })
        return
      }

      const list = (result.data || []).map(item => ({
        ...item,
        typeText: item.type === 'import' ? '导入文件' : '导出文件',
        createTimeText: this.formatFileTime(item.createTime)
      }))

      this.setData({ exportFileList: list })
    }).catch(err => {
      this.setData({ exportFileIsLoading: false })
      wx.showToast({ title: '加载文件失败', icon: 'none' })
      console.error(err)
    })
  },

  copyExportFileUrl(e) {
    const file = e.currentTarget.dataset.file
    if (!file || !file.tempFileURL) {
      wx.showToast({ title: '未获取到下载链接', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: file.tempFileURL,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    })
  },

  deleteExportFile(e) {
    const file = e.currentTarget.dataset.file
    if (!file || !file._id) return

    wx.showModal({
      title: '确认删除',
      content: `确定删除文件"${file.fileName}"吗？删除后不可恢复。`,
      confirmColor: '#e64340',
      success: res => {
        if (!res.confirm) return

        wx.showLoading({ title: '删除中' })
        wx.cloud.callFunction({
          name: 'adminDeleteExportFile',
          data: { _id: file._id }
        }).then(resp => {
          wx.hideLoading()
          const result = resp.result
          if (result && result.success) {
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadExportFiles()
          } else {
            wx.showToast({ title: result?.message || '删除失败', icon: 'none' })
          }
        }).catch(err => {
          wx.hideLoading()
          wx.showToast({ title: '删除失败', icon: 'none' })
          console.error(err)
        })
      }
    })
  },

  splitDateTime(value) {
    if (!value) return { date: '', time: '' }
    const text = String(value)
    const parts = text.split(' ')
    return {
      date: parts[0] || '',
      time: parts[1] || ''
    }
  },

  showEditRecord(e) {
    const record = e.currentTarget.dataset.record
    if (!record) return

    const start = this.splitDateTime(record.startTime)
    const end = this.splitDateTime(record.endTime || record.actualEndTime)
    const vehicleIndex = this.data.vehicleList.findIndex(v => v._id === record.vehicleId)

    this.setData({
      showRecordModal: true,
      editRecordId: record._id,
      editRecordVehicleIndex: vehicleIndex >= 0 ? vehicleIndex : -1,
      editRecord: {
        vehicleId: record.vehicleId || '',
        vehiclePlate: record.vehiclePlate || '',
        purpose: record.purpose || '',
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        status: record.status || ''
      }
    })
  },

  onEditRecordVehicleChange(e) {
    const index = e.detail.value
    const vehicle = this.data.vehicleList[index]
    if (!vehicle) return

    this.setData({
      editRecordVehicleIndex: index,
      'editRecord.vehicleId': vehicle._id,
      'editRecord.vehiclePlate': vehicle.plateNumber || ''
    })
  },

  onEditRecordStartDateChange(e) {
    this.setData({ 'editRecord.startDate': e.detail.value })
  },

  onEditRecordStartTimeChange(e) {
    this.setData({ 'editRecord.startTime': e.detail.value })
  },

  onEditRecordEndDateChange(e) {
    this.setData({ 'editRecord.endDate': e.detail.value })
  },

  onEditRecordEndTimeChange(e) {
    this.setData({ 'editRecord.endTime': e.detail.value })
  },

  onEditRecordPurposeInput(e) {
    this.setData({ 'editRecord.purpose': e.detail.value })
  },

  confirmEditRecord() {
    const record = this.data.editRecord
    if (!record.vehicleId || !record.startDate || !record.startTime || !record.purpose) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    const startTime = `${record.startDate} ${record.startTime}`
    const endTime = record.endDate && record.endTime ? `${record.endDate} ${record.endTime}` : ''

    wx.showLoading({ title: '保存中' })
    wx.cloud.callFunction({
      name: 'adminUpdateApplication',
      data: {
        _id: this.data.editRecordId,
        vehicleId: record.vehicleId,
        vehiclePlate: record.vehiclePlate,
        purpose: record.purpose,
        startTime,
        endTime
      }
    }).then(res => {
      wx.hideLoading()
      const result = res.result
      if (result && result.success) {
        wx.showToast({ title: '修改成功', icon: 'success' })
        this.hideModal()
        this.refreshRecords()
        this.loadVehicles()
      } else {
        wx.showToast({ title: result?.message || '修改失败', icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '修改失败', icon: 'none' })
      console.error(err)
    })
  },

  showAddUser() {
    this.setData({ 
      showUserModal: true,
      isEditMode: false,
      editUserId: '',
      newUser: { name: '', department: '项目部', role: 'user', roleName: '普通用户', openid: '' },
      newUserDeptIndex: 0,
      newUserRoleIndex: 0
    })
  },

  showEditUser(e) {
    const user = e.currentTarget.dataset.user
    const deptIndex = this.data.departmentList.indexOf(user.department)
    const roleIndex = this.data.roleList.findIndex(r => r.value === user.role)
    
    this.setData({
      showUserModal: true,
      isEditMode: true,
      editUserId: user._id,
      newUser: {
        name: user.name,
        department: user.department || '项目部',
        role: user.role || 'user',
        roleName: this.data.roleText[user.role] || '普通用户',
        openid: user.openid || ''
      },
      newUserDeptIndex: deptIndex >= 0 ? deptIndex : 0,
      newUserRoleIndex: roleIndex >= 0 ? roleIndex : 0
    })
  },

  onUserInput(e) {
    this.setData({ 'newUser.name': e.detail.value })
  },

  onUserDeptChange(e) {
    const index = e.detail.value
    this.setData({
      newUserDeptIndex: index,
      'newUser.department': this.data.departmentList[index]
    })
  },

  onUserRoleChange(e) {
    const index = e.detail.value
    const role = this.data.roleList[index]
    this.setData({
      newUserRoleIndex: index,
      'newUser.role': role.value,
      'newUser.roleName': role.name
    })
  },

  onUserOpenidInput(e) {
    this.setData({ 'newUser.openid': e.detail.value })
  },

  confirmAddUser() {
    const user = this.data.newUser
    if (!user.name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' })
      return
    }
    
    if (this.data.isEditMode) {
      wx.showLoading({ title: '保存中' })
      wx.cloud.callFunction({
        name: 'adminUpdateUser',
        data: {
          _id: this.data.editUserId,
          name: user.name,
          department: user.department,
          role: user.role,
          openid: user.openid || ''
        }
      }).then(res => {
        wx.hideLoading()
        if (res.result.success) {
          wx.showToast({ title: '修改成功', icon: 'success' })
          this.hideModal()
          this.loadUsers()
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
        }
      }).catch(err => {
        wx.hideLoading()
        wx.showToast({ title: '修改失败', icon: 'none' })
        console.error(err)
      })
      return
    }
    
    wx.showLoading({ title: '添加中' })
    wx.cloud.callFunction({
      name: 'adminAddUser',
      data: {
        name: user.name,
        department: user.department,
        role: user.role,
        openid: user.openid || ''
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.hideModal()
        this.loadUsers()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '添加失败', icon: 'none' })
      console.error(err)
    })
  },

  deleteUser(e) {
    const user = e.currentTarget.dataset.user
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除用户"${user.name}"吗？删除后不可恢复。`,
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' })
          wx.cloud.callFunction({
            name: 'adminDeleteUser',
            data: { _id: user._id }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadUsers()
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          }).catch(err => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
            console.error(err)
          })
        }
      }
    })
  },

  showAddVehicle() {
    this.setData({ 
      showVehicleModal: true,
      newVehicle: { plateNumber: '', type: '皮卡' },
      newVehicleTypeIndex: 0
    })
  },

  onVehicleInput(e) {
    this.setData({ 'newVehicle.plateNumber': e.detail.value })
  },

  onVehicleTypeChange(e) {
    const index = e.detail.value
    this.setData({
      newVehicleTypeIndex: index,
      'newVehicle.type': this.data.vehicleTypeList[index]
    })
  },

  confirmAddVehicle() {
    const v = this.data.newVehicle
    if (!v.plateNumber) {
      wx.showToast({ title: '请填写车牌号', icon: 'none' })
      return
    }
    
    if (this.data.isEditMode) {
      wx.showLoading({ title: '保存中' })
      wx.cloud.callFunction({
        name: 'adminUpdateVehicle',
        data: {
          _id: this.data.editVehicleId,
          plateNumber: v.plateNumber,
          type: v.type
        }
      }).then(res => {
        wx.hideLoading()
        if (res.result.success) {
          wx.showToast({ title: '修改成功', icon: 'success' })
          this.hideModal()
          this.loadVehicles()
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
        }
      }).catch(err => {
        wx.hideLoading()
        wx.showToast({ title: '修改失败', icon: 'none' })
        console.error(err)
      })
      return
    }
    
    wx.showLoading({ title: '添加中' })
    wx.cloud.callFunction({
      name: 'adminAddVehicle',
      data: {
        plateNumber: v.plateNumber,
        type: v.type
      }
    }).then(res => {
      wx.hideLoading()
      if (res.result.success) {
        wx.showToast({ title: '添加成功', icon: 'success' })
        this.hideModal()
        this.loadVehicles()
      } else {
        wx.showToast({ title: res.result.message, icon: 'none' })
      }
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '添加失败', icon: 'none' })
      console.error(err)
    })
  },

  showEditVehicle(e) {
    const vehicle = e.currentTarget.dataset.vehicle
    const typeIndex = this.data.vehicleTypeList.indexOf(vehicle.type)
    
    this.setData({
      showVehicleModal: true,
      isEditMode: true,
      editVehicleId: vehicle._id,
      newVehicle: {
        plateNumber: vehicle.plateNumber || '',
        type: vehicle.type || '皮卡'
      },
      newVehicleTypeIndex: typeIndex >= 0 ? typeIndex : 0
    })
  },

  deleteVehicle(e) {
    const vehicle = e.currentTarget.dataset.vehicle
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除车辆"${vehicle.plateNumber}"吗？删除后不可恢复。`,
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' })
          wx.cloud.callFunction({
            name: 'adminDeleteVehicle',
            data: { _id: vehicle._id }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadVehicles()
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          }).catch(err => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
            console.error(err)
          })
        }
      }
    })
  },

  hideModal() {
    this.setData({ 
      showUserModal: false,
      showVehicleModal: false,
      showRecordModal: false,
      isEditMode: false,
      editUserId: '',
      editVehicleId: '',
      editRecordId: '',
      editRecordVehicleIndex: -1
    })
  },

  copyOpenid() {
    wx.setClipboardData({
      data: this.data.currentOpenid,
      success: () => {
        wx.showToast({ title: '识别码已复制', icon: 'success' })
      }
    })
  },

  deleteRecord(e) {
    const record = e.currentTarget.dataset.record
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除编号"${record.serialNo}"的记录吗？删除后不可恢复。`,
      confirmColor: '#e64340',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' })
          wx.cloud.callFunction({
            name: 'deleteApplication',
            data: { _id: record._id }
          }).then(res => {
            wx.hideLoading()
            if (res.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.refreshRecords()  // 删除后刷新
            } else {
              wx.showToast({ title: res.result.message, icon: 'none' })
            }
          }).catch(err => {
            wx.hideLoading()
            wx.showToast({ title: '删除失败', icon: 'none' })
            console.error(err)
          })
        }
      }
    })
  },

  exportData() {
    wx.showLoading({ title: '生成中' })
    
    wx.cloud.callFunction({
      name: 'exportApplications'
    }).then(res => {
      wx.hideLoading()
      
      const result = res.result
      
      if (!result || !result.success) {
        wx.showToast({ title: result?.message || '导出失败', icon: 'none' })
        return
      }
      
      const fileURL = result.fileURL
      
      if (!fileURL) {
        wx.showToast({ title: '未获取到下载链接', icon: 'none' })
        return
      }
      
      wx.showModal({
        title: '导出成功',
        content: `共导出 ${result.count} 条记录，点击"复制链接"后在浏览器粘贴下载`,
        confirmText: '复制链接',
        success: (r) => {
          if (r.confirm) {
            wx.setClipboardData({
              data: fileURL,
              success: () => {
                wx.showToast({ title: '链接已复制', icon: 'success' })
              },
              fail: () => {
                wx.showModal({
                  title: '请手动复制',
                  content: fileURL,
                  showCancel: false
                })
              }
            })
          }
        }
      })
      
    }).catch(err => {
      wx.hideLoading()
      wx.showToast({ title: '导出失败', icon: 'none' })
      console.error('导出失败:', err)
    })
  },

  // 记录管理：查看申请详情
  goRecordDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  }

})
