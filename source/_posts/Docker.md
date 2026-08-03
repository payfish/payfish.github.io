---
title: Docker
date: 2024-07-16 19:38:11
tags: Docker
category: Docker
---

### 镜像和容器

**镜像**：镜像不仅包含应用本身，还包含应用运行时所需的环境、配置、系统函数库。因为包含了环境，所以镜像可以运行在各种操作系统上

**容器**：Docker在运行镜像时创建的一个隔离环境（进程），跟其他的进程相互隔离、互不干扰	

镜像你可以把它看成Java中的类，而容器可以看做是类的实例化对象

![docker部署镜像流程](docker部署镜像流程.png)

### 部署MySQL

```
docker run -d \
  --name mysql \
  -p 3306:3306 \
  -e TZ=Asia/Shanghai \
  -e MYSQL_ROOT_PASSWORD=****** \
  mysql
```

- `docker run -d` ：创建并运行一个容器，`-d`则是让容器以后台进程运行
- `--name`` mysql ` : 给容器起个名字叫`mysql`，你可以叫别的
- `-p 3306:3306` : 设置端口映射。
  - **容器是隔离环境**，外界不可访问。但是可以**将宿主机端口映射容器内到端口**，当访问宿主机指定端口时，就是在访问容器内的端口了。
  - 容器内端口往往是由容器内的进程决定，例如MySQL进程默认端口是3306，因此容器内端口一定是3306；而宿主机端口则可以任意指定，一般与容器内保持一致。
  - 格式： `-p 宿主机端口:容器内端口`，示例中就是将宿主机的3306映射到容器内的3306端口
- `-e TZ=Asia/Shanghai` : 配置容器内进程运行时的一些参数
  - 格式：`-e KEY=VALUE`，KEY和VALUE都由容器内进程决定
  - 案例中，`TZ=Asia/Shanghai`是设置时区；
- `mysql` : 设置**镜像**名称，Docker会根据这个名字搜索并下载镜像
  - 格式：`REPOSITORY:TAG`，例如`mysql:8.0`，其中`REPOSITORY`可以理解为镜像名，`TAG`是版本号
  - 在未指定`TAG`的情况下，默认是最新版本，也就是`mysql:latest`



### 常见命令

- docker pull：从镜像仓库拉去镜像到本地
- docker push：将制作好的镜像推送到镜像仓库
- docker images：查看所有的本地镜像
- docker rmi：删除本地镜像
- docker build：通过DOCKERFILE打包制作镜像
- docker save：保存镜像为一个压缩包
- docker load：load压缩包为本地镜像
- docker run：拉取镜像（如果本地没有），创建容器（每次创建一个新容器）
- docker stop：停止容器，（停止容器内部的进程）
- docker start：启动容器（启动停止的容器）
- docker ps：查看容器的运行状态
- docker rm：删除容器
- docker logs：查看容器运行日志
- docker exec：进入容器，执行操作
- docker inspect：查看容器详细信息

![docker常见命令](常见命令.png)

### 数据卷

#### 定义

**volume**是一个虚拟目录，是容器内目录和宿主机目录之间映射的桥梁

docker提供的容器内运行环境只是满足镜像运行的最小环境，使用docker exec命令进入容器后，连vi命令都无法使用，而在外面的宿主机中使用这些命令特别方便。

建立起数据卷挂载后，docker容器内数据卷目录会和宿主机下对应目录双向绑定，其间的内容同步更新

#### **优点**

- 数据持久性：即使容器被删除，数据卷中的数据也不会丢失，可以被其他容器使用。
- 数据共享：数据卷可以被多个容器同时挂载，实现容器间的数据共享。这对于需要多个容器共享数据的场景非常有用。

**数据卷有点像 ``Linux`` 中的硬链接**

- **硬链接**：在是另外一个位置创建源文件的链接文件，相当于复制了一份，占用资源会倍增。硬链接一旦创建，源文件和链接文件任何一方修改文件都会同步修改。

- **软链接**：指向源文件地址的一个引用，不占用资源

#### 实例

> 在执行docker run命令时，使用 ``-v``  **数据卷** ``:`` **容器内目录**可以完成数据卷挂载

- **匿名卷**：只指定容器内的路径，docker会自动在/var/lib/docker/volumes/下创建一个匿名卷，挂载到指定路径

```
docker run -d -v /container/path my-image
```

- **命名卷**：

```java
docker volume create my-volume //可以手动创建
docker run -d -v my-volume:/container/path my-image //运行容器时使用这个命名卷，若无docker会帮我们创建
```

- **绑定挂载**：绑定宿主机的目录到容器目录

```java
//mysql 本地目录挂载实例
docker run -d \
  --name mysql \
  -p 3306:3306 \
  -e TZ=Asia/Shanghai \
  -e MYSQL_ROOT_PASSWORD=123 \
  -v ./mysql/data:/var/lib/mysql \
  -v ./mysql/conf:/etc/mysql/conf.d \
  -v ./mysql/init:/docker-entrypoint-initdb.d \
  mysql
```



### 镜像

我们要从0部署一个Java应用，大概流程是这样：

- 准备一个linux服务（CentOS或者Ubuntu均可）
- 安装并配置JDK
- 上传Jar包
- 运行jar包

上述步骤中的每一次操作其实都是在生产一些文件（系统运行环境、函数库、配置最终都是磁盘文件），所以**镜像就是一堆文件的集合**。

![docker镜像结构](镜像结构.png)

### DockerFile

由于制作镜像的过程中，需要逐层处理和打包，比较复杂，所以Docker就提供了自动打包镜像的功能。我们只需要将打包的过程，每一层要做的事情用固定的语法写下来，交给Docker去执行即可。而这种记录镜像结构的文件就称为**Dockerfile**，其常见语法有：

| **指令**       | **说明**                                     | **示例**                     |
| :------------- | :------------------------------------------- | :--------------------------- |
| **FROM**       | 指定基础镜像                                 | `FROM centos:6`              |
| **ENV**        | 设置环境变量，可在后面指令使用               | `ENV key value`              |
| **COPY**       | 拷贝本地文件到镜像的指定目录                 | `COPY ./xx.jar /tmp/app.jar` |
| **RUN**        | 执行Linux的shell命令，一般是安装过程的命令   | `RUN yum install gcc`        |
| **EXPOSE**     | 指定容器运行时监听的端口，是给镜像使用者看的 | EXPOSE 8080                  |
| **ENTRYPOINT** | 镜像中应用的启动命令，容器运行时调用         | ENTRYPOINT java -jar xx.jar  |



### docker网络

docker在安装之初便默认创建了一个网桥bridge，"Gateway": "172.17.0.1", "IPAddress": "172.17.0.2"，运行容器时若不指定网络便会默认桥接进入这个网桥。

为了使我们的商场项目和MySQL运行在同一网桥下，以便访问，我们可以自定义一个网桥：``docker network create baima`` ，通过 ``docker network inspect baima``查看这个网桥的信息：

```
"Name": "baima",
"Id": "ad4d38c784bcf47830bafe984d2a6fb9fff12cd407da65d937d6ce02fabfc4a9",
"Created": "2024-07-18T16:08:52.000559732+08:00",
"Scope": "local",
"Driver": "bridge",
"EnableIPv6": false,
"IPAM": {
    "Driver": "default",
    "Options": {},
    "Config": [
        {
            "Subnet": "172.18.0.0/16",
            "Gateway": "172.18.0.1"
        }
```

通过``docker network connect baima mysql`` 将mysql容器加入baima中，也可以在运行容器时通过添加 --network baima 参数，在创建容器时直接将其加入网段中。



### docker部署项目

想要通过docker部署项目到云服务器上，因为我的后端服务是8080端口，所以要先去安全组开放一下端口。

接着通过maven将项目打包，自定义DOCKERFILE，一并上传到服务器。

```dockerfile
# DOCKERFILE
# 基础镜像
FROM openjdk:11.0-jre-buster
# 设定时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
# 拷贝jar包
COPY hm-service.jar /app.jar
# 入口
ENTRYPOINT ["java", "-jar", "/app.jar"]
```

通过``docker build -t hmall .`` 打包成镜像

```
[root@fu1sh ~]# docker images
REPOSITORY   TAG               IMAGE ID       CREATED       SIZE
hmall        latest            d3063508f8b0   3 hours ago   370MB
mysql        latest            3218b38490ce   2 years ago   516MB
openjdk      11.0-jre-buster   57925f2e4cff   2 years ago   301MB
```

通过 ``docker run -d --name hm --network baima -p 8080:8080 hmall`` 运行容器

````shell
[root@fu1sh ~]# dps
CONTAINER ID   IMAGE     PORTS                                                  STATUS       NAMES
284a8e00bbfe   hmall     0.0.0.0:8080->8080/tcp, :::8080->8080/tcp              Up 3 hours   hm
5adc956a74df   mysql     0.0.0.0:3306->3306/tcp, :::3306->3306/tcp, 33060/tcp   Up 4 hours   mysql

````

运行成功后就可以在浏览器访问我们的项目了。

### DockerCompose

集成部署，不用一个一个部署，比如部署完mysql部署后端代码，最后部署nginx，这些统统可以通过docker-compose.yml文件一键部署启动

```docker-compose.yml
version: "3.8"

services:
  mysql:
    image: mysql
    container_name: mysql
    ports:
      - "3306:3306"
    environment:
      TZ: Asia/Shanghai
      MYSQL_ROOT_PASSWORD: 123
    volumes:
      - "./mysql/conf:/etc/mysql/conf.d"
      - "./mysql/data:/var/lib/mysql"
    networks:
      - new
networks:
  new:
    name: baima
```

这个文件和我们运行镜像的命令几乎一模一样，这里不再赘述。接着通过命令启动即可

```
docker compose [OPTIONS] [COMMAND]
```

|  **类型**   | **参数或指令** |                           **说明**                           |
| :---------: | :------------: | :----------------------------------------------------------: |
| **OPTIONS** |       -f       |                 指定compose文件的路径和名称                  |
|             |       -p       | 指定project名称。project就是当前compose文件中设置的多个service的集合，是逻辑概念 |
| **COMMAND** |       up       |                  创建并启动所有service容器                   |
|             |      down      |                   停止并移除所有容器、网络                   |
|             |       ps       |                      列出所有启动的容器                      |
|             |      logs      |                      查看指定容器的日志                      |
|             |      stop      |                           停止容器                           |
|             |     start      |                           启动容器                           |
|             |    restart     |                           重启容器                           |
