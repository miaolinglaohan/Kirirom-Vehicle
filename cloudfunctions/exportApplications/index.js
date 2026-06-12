const cloud = require('wx-server-sdk')
const xlsx = require('xlsx')
const fs = require('fs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

async function checkAdmin() {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()

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

function formatDateTime(value) {
  if (!value) return ''
  if (typeof value === 'string') return value

  const date = new Date(value)
  if (isNaN(date.getTime())) return ''

  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

exports.main = async (event) => {
  const auth = await checkAdmin()
  if (!auth.ok) return auth.response

  const { startDate, endDate, status, department } = event

  try {
    const db = cloud.database()
    const _ = db.command
    const where = {}

    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate + 'T00:00:00'))
        .and(_.lte(new Date(endDate + 'T23:59:59')))
    }
    if (status && status !== 'all') {
      where.status = status
    }
    if (department && department !== 'all') {
      where.department = department
    }

    const maxLimit = 100
    const countResult = await db.collection('applications').where(where).count()
    const total = countResult.total
    const batchTimes = Math.ceil(total / maxLimit)

    const tasks = []
    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db.collection('applications')
          .where(where)
          .orderBy('createTime', 'desc')
          .skip(i * maxLimit)
          .limit(maxLimit)
          .get()
      )
    }

    let allData = []
    const results = await Promise.all(tasks)
    results.forEach(res => {
      allData = allData.concat(res.data)
    })

    if (allData.length === 0) {
      return { success: false, message: '没有找到符合条件的记录' }
    }

    const headers = [
      '序号',
      '申请人',
      '驾驶员',
      '使用部门',
      '用途',
      '车辆领用时间',
      '车辆归还时间',
      '使用车辆',
      '审批人',
      '备注'
    ]

    const rows = allData.map((item, index) => {
      const applicant = item.applicantName || item.applicant || item.userName || ''
      const driver = item.driverName || ''
      const dept = item.department || ''
      const purpose = item.purpose || ''
      const startTime = formatDateTime(item.startTime)
      const returnTime = formatDateTime(item.endTime || item.actualEndTime)
      const vehicle = item.vehiclePlate || item.plateNumber || ''
      const approver = item.approverName || item.approver || ''
      const remark = item.remark || ''

      return [
        index + 1,
        applicant,
        driver,
        dept,
        purpose,
        startTime,
        returnTime,
        vehicle,
        approver,
        remark
      ]
    })

    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 20 }
    ]

    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, '车辆使用登记')

    const now = new Date()
    const bangkokTime = new Date(now.getTime() + (7 * 60 * 60 * 1000))
    const pad = n => String(n).padStart(2, '0')
    const dateStr = `${bangkokTime.getUTCFullYear()}${pad(bangkokTime.getUTCMonth() + 1)}${pad(bangkokTime.getUTCDate())}`
    const timeStr = `${pad(bangkokTime.getUTCHours())}${pad(bangkokTime.getUTCMinutes())}${pad(bangkokTime.getUTCSeconds())}`

    const fileName = `Vehicle_Usage_Record_${dateStr}_${timeStr}.xlsx`
    const tempPath = `/tmp/${fileName}`
    xlsx.writeFile(wb, tempPath)

    const fileBuffer = fs.readFileSync(tempPath)
    const cloudPath = `excel_exports/${fileName}`
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: fileBuffer
    })

    await db.collection('exportFiles').add({
      data: {
        fileID: uploadRes.fileID,
        fileName,
        cloudPath,
        type: 'excel',
        count: allData.length,
        createTime: db.serverDate()
      }
    })

    const tempFileRes = await cloud.getTempFileURL({
      fileList: [uploadRes.fileID]
    })

    fs.unlinkSync(tempPath)

    return {
      success: true,
      message: `成功导出 ${allData.length} 条记录`,
      count: allData.length,
      fileURL: tempFileRes.fileList[0].tempFileURL,
      fileName
    }
  } catch (err) {
    console.error('导出失败:', err)
    return { success: false, message: '导出失败：' + err.message }
  }
}
