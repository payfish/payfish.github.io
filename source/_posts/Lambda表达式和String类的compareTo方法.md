---
layout: java
title: Lambda表达式和String类的compareTo方法
date: 2024-05-16 19:49:23
tags: Java基础
category: Java
---

## Lambda表达式
可以将Lambda表达式理解为一个匿名函数； Lambda表达式允许将一个函数作为另外一个函数的参数； 我们可以把 Lambda 表达式理解为是一段可以传递的代码（将代码作为实参）,也可以理解为函数式编程，将一个函数作为参数进行传递。

- 实例

```java
public class TestLambda {
    public static void main(String[] args) {
       Thread thread = new Thread(new MyRunnable());
       thread.start();
       thread.close();
    }
}
class MyRunnable implements Runnable{
	@Override
    public void run() {
        System.out.println("Hello");
    }
}
```

为了使这段代码更加简洁，可以使用匿名内部类重构：

```java
public class TestLambda {
    public static void main(String[] args) {
        new Thread(new Runnable() {
        //这里的 new 了 Runnable() 接口，在这个 new 的接口里面，我们写了这个接口的实现类。
        //这里可以看出，我们把一个重写的 run() 方法传入了一个构造函数中。
            @Override
            public void run() {
                System.out.println("Hello");
            }
        }).start();
    }
}
```

继续简化，使用Lambda：

```java
public class TestLambda {
    public static void main(String[] args) {
        new Thread(() -> System.out.println("Hello")).start();
    }
}
```

# String的compareTo()方法

- 源码

```java
public class String implements java.io.Serializable, Comparable<String>, CharSequence {

    @Override
    public int compareTo(String anotherString) {
        int len1 = value.length;
        int len2 = anotherString.value.length;
        int lim = Math.min(len1, len2);
        char v1[] = value;
        char v2[] = anotherString.value;

        int k = 0;
        while (k < lim) {
            char c1 = v1[k];
            char c2 = v2[k];
            if (c1 != c2) {
                return c1 - c2;
            }
            k++;
        }
        return len1 - len2;
    }
}
```

#### compareTo的逻辑

总结下来就是（o1，o2）-> o1 - o2。这里的减法有三种情况：

- 负数：不交换前后元素的位置
- 正数：交换位置
- 0：不交换

如果数比较大的话还是建议直接用compareTo方法，用减法可能导致溢出，比如Integer.MIN_VALUE - 1。

# 剑指offer.把数组排成最小的数

输入一个正整数数组，把数组里所有数字拼接起来排成一个数，打印能拼接出的所有数字中最小的一个。输出格式为字符串。

样例:
```
输入：[3, 32, 321]

输出：321323
```

- 思路：自定义排序规则，``nums[i] < nums[j]`` 当且仅当 ``nums[i] + nums[j](字符串连接) < nums[j] + nums[i]``

- 代码：
```java
class Solution {
    public String printMinNumber(int[] nums) {
        StringBuilder sb = new StringBuilder();
        int n = nums.length;
        // 将整数数组转换为字符串数组
        String[] strNums = new String[n];
        for (int i = 0; i < n; i++) {
            strNums[i] = String.valueOf(nums[i]);
        }
        // 自定义排序逻辑，按连接后的字符串进行比较
        Arrays.sort(strNums, (o1, o2) -> (o1 + o2).compareTo(o2 + o1));
        // 拼接排序后的字符串数组
        for (String str : strNums) {
            sb.append(str);
        }
        return sb.toString();
    }
}

```