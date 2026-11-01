# Quy trình làm việc nhóm

- Mỗi người làm trên một nhánh `feat/tv<số>-<tên>`.
- Chỉ sửa thư mục/phần mình phụ trách; cần sửa phần người khác thì nhắn họ.
- Mở Pull Request vào `dev`; TV1 review và merge.
- Chỉ đưa `dev` vào `main` khi hệ thống chạy ổn.
- Commit nhỏ, nội dung commit rõ ràng.
- Chạy `git pull origin dev` trước khi bắt đầu làm mỗi ngày.
- File nặng như model và dataset để trên Drive, không commit vào Git.

## Phụ thuộc bàn giao

| Bên giao | Bàn giao | Bên nhận |
|---|---|---|
| TV2 | `best.pt` | TV3 |
| TV3 | `run_inference()` trong `backend/inference.py` | TV4 |
| TV4 | Ứng dụng | TV5 |
