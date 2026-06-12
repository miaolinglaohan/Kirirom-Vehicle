const cloud = require('wx-server-sdk')
const xlsx = require('node-xlsx')

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

  return { ok: true }
}

function formatExcelTime(value) {
  if (!value && value !== 0) return ''

  const pad = n => String(n).padStart(2, '0')
  const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

  if (typeof value === 'number') {
    return toStr(new Date((value - 25569) * 86400 * 1000))
  }
  if (value instanceof Date) {
    return toStr(value)
  }
  return String(value).trim()
}

function getColumnMap(headerRow) {
  const headers = (headerRow || []).map(item => String(item || '').trim())
  const hasDriverColumn = headers.includes('驾驶员')

  if (hasDriverColumn) {
    return {
      applicantName: 1,
      driverName: 2,
      department: 3,
      purpose: 4,
      startTime: 5,
      returnTime: 6,
      vehiclePlate: 7,
      approverName: 8,
      remark: 9
    }
  }

  return {
    applicantName: 1,
    driverName: -1,
    department: 2,
    purpose: 3,
    startTime: 4,
    returnTime: 5,
    vehiclePlate: 6,
    approverName: 7,
    remark: 8
  }
}

async function registerImportFile(db, fileID, fileName, cloudPath, count) {
  const existRes = await db.collection('exportFiles').where({ fileID }).limit(1).get()
  if (existRes.data && existRes.data.length > 0) return

  await db.collection('exportFiles').add({
    data: {
      fileID,
      fileName: fileName || `import_${Date.now()}.xlsx`,
      cloudPath,
      type: 'import',
      count,
      createTime: new Date()
    }
  })
}

exports.main = async (event) => {
  const auth = await checkAdmin()
  if (!auth.ok) return auth.response

  const db = cloud.database()
  const fileID = event.fileID
  const fileName = event.fileName || ''
  const cloudPath = event.cloudPath || ''
  const action = event.action || 'import'
  const offset = Number(event.offset || 0)
  const limit = Number(event.limit || 5)

  if (!fileID) {
    return { success: false, message: '缺少 fileID' }
  }
  if (limit <= 0 || limit > 20) {
    return { success: false, message: 'limit 取值范围应为 1-20' }
  }

  try {
    if (action === 'register') {
      await registerImportFile(db, fileID, fileName, cloudPath, 0)
      return { success: true, message: '文件登记成功' }
    }

    const downloadRes = await cloud.downloadFile({ fileID })
    const sheets = xlsx.parse(downloadRes.fileContent)

    if (!sheets || sheets.length === 0) {
      return { success: false, message: 'Excel 文件为空' }
    }

    const rows = sheets[0].data || []
    if (rows.length < 2) {
      return { success: false, message: 'Excel 无有效数据' }
    }

    const columnMap = getColumnMap(rows[0])
    const allRows = rows.slice(1).filter(row => row && row[columnMap.applicantName])
    if (allRows.length > 1000) {
      return { success: false, message: '单次最多导入 1000 行，请拆分文件后导入' }
    }

    const total = allRows.length
    if (offset === 0) {
      try {
        await registerImportFile(db, fileID, fileName, cloudPath, total)
      } catch (e) {}
    }

    const batchRows = allRows.slice(offset, offset + limit)
    let successCount = 0
    let failCount = 0

    for (const row of batchRows) {
      const startTimeStr = formatExcelTime(row[columnMap.startTime])
      const returnTimeStr = formatExcelTime(row[columnMap.returnTime])
      const now = Date.now()
      const random = Math.random().toString(36).slice(2, 8)

      const doc = {
        applicantName: row[columnMap.applicantName] || '',
        driverId: '',
        driverName: columnMap.driverName >= 0 ? row[columnMap.driverName] || '' : '',
        department: row[columnMap.department] || '',
        purpose: row[columnMap.purpose] || '',
        startTime: startTimeStr,
        endTime: returnTimeStr,
        actualEndTime: returnTimeStr,
        vehiclePlate: row[columnMap.vehiclePlate] || '',
        vehicleId: '',
        approverName: row[columnMap.approverName] || '',
        status: 'returned',
        createTime: startTimeStr ? new Date(startTimeStr) : db.serverDate(),
        openid: '',
        remark: row[columnMap.remark] || '从Excel导入',
        serialNo: `IMPORT_${now}_${random}`
      }

      try {
        await db.collection('applications').add({ data: doc })
        successCount++
      } catch (e) {
        failCount++
      }
    }

    const nextOffset = offset + batchRows.length
    const done = nextOffset >= total

    return {
      success: true,
      total,
      batchSize: batchRows.length,
      successCount,
      failCount,
      nextOffset,
      done,
      message: done
        ? `导入完成：成功 ${successCount} 条，失败 ${failCount} 条（本批）`
        : `已处理 ${nextOffset}/${total} 条，继续导入中`
    }
  } catch (err) {
    const msg = err && err.message ? err.message : '导入失败'
    return { success: false, message: msg }
  }
}
