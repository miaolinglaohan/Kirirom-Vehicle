const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function checkAdmin() {
  const wxContext = cloud.getWXContext()

  const userRes = await db.collection('users')
    .where({ openid: wxContext.OPENID })
    .limit(1)
    .get()

  const user = userRes.data[0]

  if (!user || user.role !== 'admin') {
    return {
      ok: false,
      response: {
        success: false,
        message: '无权限，仅管理员可操作'
      }
    }
  }

  return { ok: true, user }
}

exports.main = async (event, context) => {
  const auth = await checkAdmin()
  if (!auth.ok) return auth.response

  try {
    const res = await db.collection('exportFiles')
      .orderBy('createTime', 'desc')
      .limit(100)
      .get()

    const files = res.data || []
    const fileIDs = files.map(file => file.fileID).filter(Boolean)
    let urlMap = {}

    if (fileIDs.length > 0) {
      const tempUrlRes = await cloud.getTempFileURL({ fileList: fileIDs })
      ;(tempUrlRes.fileList || []).forEach(item => {
        urlMap[item.fileID] = item.tempFileURL || ''
      })
    }

    const data = files.map(file => ({
      _id: file._id,
      fileID: file.fileID,
      fileName: file.fileName,
      cloudPath: file.cloudPath,
      type: file.type || '',
      count: file.count || 0,
      createTime: file.createTime || '',
      tempFileURL: urlMap[file.fileID] || ''
    }))

    return { success: true, data }
  } catch (err) {
    return { success: false, message: err.message }
  }
}
