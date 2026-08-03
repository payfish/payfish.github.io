---
title: MarkDown插入图片
date: 2024-04-27 19:20:25
tags: MarkDown语法
category: MarkDown
---

1. 本地路径下的图片
- 本地相对路径
```
![本地路径](image.png)         (图片在md文件的同一级)
![本地路径](pic\image.png)     (图片在md文件的下一级)
或者：
<img src="image.png">
<img src="pic\image.png">
```

- 本地绝对路径不建议使用，很多情况加载不出来

2. 控制图片大小

```
 设置图片的宽和高像素值：<img src="图片路径" width = 300 height = 200>
 设置缩放的比例：<img src="图片路径" width = 60%>
```



3. 控制图片位置
- 有left、right、center等属性
```
<div align=center>  <img src="image.png" width=60%>
```