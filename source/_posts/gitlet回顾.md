---
title: gitlet回顾
date: 2024-08-28 15:51:02
tags: Git
category: 造轮子

---

### 前言

本文是对一年前学的伯克利的CS61B课程的project2：gitlet项目的一次回顾和总结，[github连接](https://github.com/payfish/cs61b-new/tree/master/proj2)

### Gitlet总体介绍

Gitlet是UCB CS61b课程中的一个项目，实现了简化版的git，支持`add`，`commit`，`log`，`checkout`，`merge`等操作。git是一个分布式的[版本控制](https://zhida.zhihu.com/search?q=版本控制&zhida_source=entity&is_preview=1)工具，如果想要了解更多的git知识，请点击[git官网](https://link.zhihu.com/?target=https%3A//git-scm.com/)查看。

### Gitlet原理

原理上gitlet与git并无二致，都是将一个版本的所有文件内容保存起来，可以在不同版本之间进行切换，保证所有存在过的版本都不会丢失，那如何区分一个版本呢？答案是用commit命令创建一个版本快照（snapshot），就相当于用相机拍下这个时刻的照片，并且按顺序将照片串起来，当想回到某个版本时，只需要按照顺序往前翻就可以了。下图展示了Gitlet的简单原理。

![](1.jpg)

当Gitlet初始化时，系统自动生成一个init Commit，这个Commit不记录任何文件，之后，每有一个新的版本，会有一个新的Commit，Commit会记录版本文件信息，也就是图中的指针指向的两个文件。

当前最新版本的Commit会由一个Head进行标记，此处是Commit2，也就是说当前文件夹内只包含`3.txt`和`4.txt`，当需要切换到Commit1时，我们可以看到Commit1记录了`1.txt`和`2.txt`，那如何进行版本转换呢？只需要将Head移动到Commit1上，读取Commit1记录的文件`1.txt`和`2.txt`，将Commit1记录的文件重新写入到当前文件夹，并且删除`3.txt`和`4.txt`即可完成版本转换，现在的文件夹就只包含`1.txt`和`2.txt`了。

上图中Commit1和Commit2内容完全不同，如果Commit1和Commit2存在相同的文件，只需要保存一个就可以，这样能够在很大程度上节省空间。如下图所示。

![](2.webp)

### Gitlet内部结构实现

接下来说一下gitlet的内部实现，首先，`gitlet init`命令会创建`.gitlet`文件夹，`.gitlet`文件夹是一个隐藏文件，windows要先打开显示隐藏文件的设置，linux或macos可通过`ls -la`进行查看，gitlet绝大部分操作都在`.gitlet`文件夹中进行工作，此文件夹的结构如以下代码所示。

```
/*
 *   .gitlet
 *      |--objects
 *      |     |--commit and blob
 *      |--refs
 *      |    |--heads
 *      |         |--master
 *      |--HEAD
 *      |--addstage
 *      |--removestage
 */
```

### 几个重要概念

#### blob

blob就是一个文件，包括文件名和文件内容，例如Blob1的文件名叫`1.txt`，内容为111，Blob3的文件名也叫`1.txt`，但是内容变成了333，这就是两个不同的Blob。我们会把文件中的所有内容序列化为一个字节数组存储。

```java
public class Blob implements Serializable {
    
    private String filename;
    /** Byte array of the file */
    private byte[] contents;
}
```

#### tree

tree是一个Map，存储treeId和blobId

```java
public class Tree implements Serializable {
    private final Map<String, String> tree;

    public Tree() {
        tree = new TreeMap<>();
    }
}
```

#### commit

commit可以理解为系统中的所有文件在某一时刻的一个快照，

```java
public class Commit implements Serializable {

    /** When the commit took place. */
    private String timeStamp;
    /** The message of this Commit. */
    private String message;
    /** Author of this commit. */
    private String author;

    private String treeId;

    private List<String> parentList;
```

### 几个重要的功能

#### merge

> merge [branchname]

此命令是为了将两个分支进行合并，将branchname与当前分支进行合并，所以branchname一定不能是当前的分支名。`merge`命令分为两步，第一步是找split point，第二步是合并文件。

首先要做的是找到split point，也就是两个分支的最近距离的分开的Commit节点，因为后面要对split point，当前Commit，合并进来的Commit三者进行比较来确定保留的文件，这个之后再说，先看split point。如下图所示

![](3.webp)

BranchC和BranchA的split point就是Init Commit，通过DFS遍历的方式从后往前寻找，时间复杂度O(n)。

下一步就是合并文件的操作了，涉及的判断太多了这里就不说了

#### reset

> reset [commitID]

此命令即将版本回滚到指定的commitID处，首先将`HEAD`指向指定的commitID，之后进行文件操作，这里的操作其实和`checkout branch`相同，可以复用代码，最后清空缓存区即可

#### checkout

checkout有三种应用场景

- checkout – [filename]：将当前工作目录下的文件恢复到最新的一次提交的状态
- checkout [commitID] – [filename]：将当前工作目录下的文件恢复到某特定的一次提交时的状态
- checkout [branchname]：切换分支，将HEAD指向对应分支，工作目录中的文件全部替换为对应分支下的文件
