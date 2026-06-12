const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  // 兼容 detail.js 传的 id 和 _id 两种参数名
  const _id = event._id || event.id
  const endTime = event.endTime
  
  if (!_id) {
    return { success: false, message: '缺少记录ID' }
  }
  
  const db = cloud.database()
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 查当前用户
    const userRes = await db.collection('users').where({ openid }).get()
    const user = userRes.data[0]
    if (!user) {
      return { success: false, message: '用户未登录' }
    }
    
    // 查记录
    const recordRes = await db.collection('applications').doc(_id).get()
    const record = recordRes.data
    if (!record) {
      return { success: false, message: '记录不存在' }
    }
    
    // 权限判断：申请人、管理员、审批人角色可归还
    const isAdmin = user.role === 'admin'
    const isApproverRole = user.role === 'approver'
    const isApplicant = user._id === record.applicantId
    
    if (!isAdmin && !isApproverRole && !isApplicant) {
      return { success: false, message: '无权限归还' }
    }
    
    if (record.status !== 'approved') {
      return { success: false, message: '该记录不可归还，当前状态：' + record.status }
    }
    
    // 更新记录为已归还
    const updateData = {
      status: 'returned',
      actualEndTime: db.serverDate()
    }
    
    // 如果传了 endTime，用传入的值（字符串格式）
    if (endTime) {
      updateData.endTime = endTime
    }
    
    await db.collection('applications').doc(_id).update({
      data: updateData
    })
    
    // 释放车辆
    if (record.vehicleId) {
      await db.collection('vehicles').doc(record.vehicleId).update({
        data: { status: 'available' }
      })
    }
    
    return { success: true, message: '归还成功' }
  } catch (err) {
    return { success: false, message: '归还失败：' + err.message }
  }
}
