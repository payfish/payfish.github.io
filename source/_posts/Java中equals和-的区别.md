---
title: equals和==的区别
date: 2024-05-12 17:40:58
tags: Java
category: Java
---
### 基本数据类型和引用数据类型

##### 基本数据类型

- double（8）， long（8）， int（4Byte），  float（4），short（2），char（2），byte（1）， boolean（）

##### 引用数据类型

- 类， 接口， 数组

### equals和==的区别
##### == 比较值是否相等 

- 作用于基本数据类型的变量，则直接比较其存储的值是否相等
- 作用于引用类型的变量，则比较的是所指向的对象的地址是否相等，即是否是同一个对象
```
  其实==比较的不管是基本数据类型，还是引用数据类型的变量，比较的都是值，只是引用类型变量存的值是对象的地址.
```

##### equals

- equals()方法存在于Object类中，而Object类是所有类的直接或间接父类，所以说所有类中的equals()方法都继承自Object类，在没有重写equals()方法的类中，调用equals()方法其实和使用==的效果一样，比较是否是同一个对象。
- 不过，Java提供的类中，有些类都重写了equals()方法，重写后的equals()方法一般都是比较两个对象的值，比如String类。

##### == null

为什么用 ``== null``，而不用 ``equals(null)`` ?

- ``obj.equals(null)`` 如果 ``obj`` 也为 ``null`` 的话，会抛出空指针异常



### 重写equals方法必须重写hashcode

如果两个对象a，b。`a.equals(b)` 为 `true`；那么`a.hashcode()` 就必须等于 `b.hashcode()` 。这是 `hashCode()` 和 `equals()` 方法的一致性要求。

equals中参与比较的属性必须全部使用到hashcode的计算中来。

```java
public class Person {
    private String name;
    private int age;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Person person = (Person) o;
        return age == person.age && name.equals(person.name);
    }

    @Override
    public int hashCode() {
        // 使用所有参与 equals 比较的属性来计算 hashCode
        int result = 17; // 初始化非零常量
        result = 31 * result + name.hashCode(); // 使用 name 字段的 hashCode
        result = 31 * result + age; // 使用 age 字段
        return result;
    }
}
```

### 以下代码输出什么？

```java
public static void main(String[] args) {
    String s1 = new String("a") + new String("b");
    String s2 = "ab";
    String s3 = s1.intern();
    System.out.println(s1.hashCode() == s2.hashCode());
    System.out.println(s1 == s3);
}
```

- `s3 = s1.intern();`这行代码会检查字符串常量池中是否已经存在内容为 "ab" 的字符串，如果有则返回常量池中这个字符串的引用，没有则将`s1`的内容添加到常量池中并返回引用。由于常量池中已经有了内容为 "ab" 的字符串（即`s2`所指向的那个），所以`s3`会指向常量池中的这个字符串。

- String类的hashcode方法是根据内容来生成hashcode的
