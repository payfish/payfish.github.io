---
title: java导出word文档--XWPFDocument使用总结
date: 2024-04-05 14:37:09
tags: java
---

### 依赖导入
```
    <dependency>
      <groupId>org.apache.poi</groupId>
      <artifactId>poi-ooxml</artifactId>
      <version>5.2.3</version>
    </dependency>

```


### 代码

```
    XWPFDocument document = new XWPFDocument(); //创建了一个新的空白 Word 文档
    XWPFParagraph Paragraph = document.createParagraph(); //这行代码创建了一个新的段落对象，并将其添加到刚刚创建的 Word 文档中
    Paragraph.setAlignment(ParagraphAlignment.CENTER); //设置对齐方式
    XWPFRun run = Paragraph.createRun(); //XWPFRun 对象代表 Word 文档中的一个文本运行（run）,可以通过操作这个文本运行对象来设置文本内容、样式、字体等属性。
    run.setText("hello world"); //这里是输入到word的文本
    run.setBold(true); //设置字体加粗
    run.setFontSize(20); //设置字体大小（12磅对应小四）

```