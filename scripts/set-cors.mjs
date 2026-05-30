import { execSync } from 'child_process'

const BUCKET = 'mecharashi-tools.firebasestorage.app'
const PROJECT = 'mecharashi-tools'

const cors = [
  {
    origin: ['https://gitfenix1113.github.io'],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
    maxAgeSeconds: 3600,
    responseHeader: ['Content-Type', 'Authorization'],
  },
]

const token = execSync('gcloud auth print-access-token').toString().trim()

const res = await fetch(
  `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}?userProject=${PROJECT}`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cors }),
  }
)

const body = await res.json()
if (!res.ok) {
  console.error('失敗:', res.status, JSON.stringify(body, null, 2))
  process.exit(1)
}
console.log('CORS 設定成功:', JSON.stringify(body.cors, null, 2))
