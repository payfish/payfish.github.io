---
title: MarkDown表格
date: 2024-05-04 22:24:15
tags: MarkDown语法
category: MarkDown
---

1. 表格居中
```
<style>
.center 
{
  width: auto;
  display: table;
  margin-left: auto;
  margin-right: auto;
}
</style>

<div class="center">
|数组下标 | 0 | 1 | 2 | 3  | 4 |
|:----:|:----:|:----:|:----:|:----:|:----:|
| h | -1 | 2 | 1 | 3 | -1 |
| e | 2 | 4 | 3 | 4 ||
| ne | -1 | -1 | 0 | -1 ||
</div>

```

- 效果
<style>
.center 
{
  width: auto;
  display: table;
  margin-left: auto;
  margin-right: auto;
}
</style>

<div class="center">

|数组下标 | 0 | 1 | 2 | 3  | 4 |
|:----:|:----:|:----:|:----:|:----:|:----:|
| h | -1 | 2 | 1 | 3 | -1 |
| e | 2 | 4 | 3 | 4 ||
| ne | -1 | -1 | 0 | -1 ||
</div>