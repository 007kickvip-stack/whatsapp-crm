# Excel Import Debug Notes

## Issues found:
1. **日期列** (col 1): 值是 ISO 日期字符串 "2026-02-01T00:00:00.000Z" - 需要正确解析
2. **账号列** (col 2): NULL - 但 createOrder 需要 staffName 和 account
3. **客户WhatsApp** (col 3): 值是 "1647" - 只有数字，不是完整的 WhatsApp 号码
4. **发出日期列** (col 13): 值是 "2.7" - 看起来是数字而非日期（可能是 Excel 中的月.日格式）
5. **订单编号** (col 5): "花-Hasan Özdemir 02019145" - 这是订单名称不是系统编号
6. **原订单号** (col 12): 空值

## Error from screenshot:
- `insert into orders` failed - 日期参数 "Thu Jan 01 46054 00:00:00 GMT+0000" 说明日期解析错误
- params 包含: staffName=Abe Abe, account=1647, customerType=零售复购, orderStatus=顾客已收货, paymentStatus=未付款
- 问题: 日期被错误解析为 46054 年

## Root cause:
- `orderDate` 字段接收到的日期格式不正确
- `account` 列为 NULL，可能用了 WhatsApp 号码作为 account
- `shipDate` 列值是 "2.7" 不是日期
