//в прошлых лабах мы напрямую создавали сервер, сейчас используем модуль экспресс (так проще)
const express = require('express');
//подключаем модуль https
const https = require('https');
// подключаем модуль для работы с файлами
const path = require('path');
//подключаем модуль для работы с redis
const redis = require('redis');
//создаем приложение express
const app = express();
//создаем клиента сервера с заданным портом и хостом
const client = redis.createClient({
    host: "127.0.0.1",
    port: 6379,
});
//соединяемся с redis
client.connect();
//обраатываем статические файлы из папки front
app.use(express.static(path.join(__dirname, '../front')));
//используем функцию use для обработки json-запросов
app.use(express.json());
//получаем url get-запроса 
//если это /, то вызываем колбэк функцию, в которой 2 аргумента: req - тело запроса, res - результат
app.get('/', function(req, res) {
    //загружаем главную страницу проекта
    res.sendFile(path.join(__dirname, '../front/html/', 'index.html'));
});
//получаем url post запроса, если это запрос, заканчивающийся на /date
//то вызываем колбэк функцию с 2 параметрами
app.post("/date", async (req, res) => {
    //получаем из redisa массив ключей (string), в которых содержится nasa 
    //await означает, что мы приостанавлиаем выполнение асинхронной функции до тех пор, пока не выполнится текущая строчка кода
    const timeKeys = await client.keys("*nasa");
    //если длина массива ключей больше 1000
    if(timeKeys.length === 1000) {
        //устанавливаем статус ответа 429 и ошибку 
        res.status(429).send("Too many requests");
        //выходим из функции
        return;
    }
    //Проверяем, существует ли ключ counter в базе данных Redis
    //Команда client.exists("counter") возвращает промис, который разрешается в значение 1, если ключ существует, и 0, если не существует
    //counter будет равен 1, если ключ существует, и 0, если нет
    let counter = await client.exists("counter");
    //если ключ равен 0 (то есть не существует)
    if(!counter){
        //устанавливаем ключ counter со значением 1 в базе данных Redis
        await client.set("counter", 1);
        //присваиваем переменной counter строковое значение 1 (для дальнейших проверок)
        counter = "1";
        // устанавливаем время жизни ключа counter в 1 секунду
        await client.expire("counter", 1);
    }
    else {
        //если counter !=0 (то есть ключ существует)
        //увеличиваем значение ключа counter на 1
        await client.incr("counter");
        //получаем из redisa текущее значение ключа counter 
        counter = client.get("counter");
    }
    // если текущее значение больше 100
    if(counter >= 100){
        //устанавливаем статус ответа 429 с ошибкой 
        res.status(429).send("Too many requests");
        //выход из функции
        return;
    }

    //получаем из тела запроса значение date
    const { date } = req.body;
    //проверяем, есть ли в redis  данные для указанной даты (по ключу date)
    const val = await client.get(date);
    //если данные есть
    if (val) {
        //преобразуем данные из строки json в объект javascript
        const valJS = JSON.parse(val);
        //отправляем клиенту ответ с данными из кеша и счетчиком -1
        //ответ содержит данные valJS и счетчик count со значением -1, указывая, что данные взяты из кеша
        res.send({data: valJS, count: -1});
    } else {
        // этот блок кода выполняется, если данной даты нет в redis
        //делаем запрос к API NASA для получения данных за указанную дату
        //
        https.get("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=" + date, {rejectUnauthorized: false}, async (response) => {
            //инициализируем переменную data для хранения данных, полученных из API NASA
            //она будет заполняться по мере получения данных от API
            let data = "";
            //вычисляем количество запросов, сделанных к API NASA за последний час
            //из заголовков ответа извлекаются значения "x-ratelimit-limit" и "x-ratelimit-remaining", чтобы вычислить использованные запросы
            let requestsPerHour = +response.headers["x-ratelimit-limit"] - +response.headers["x-ratelimit-remaining"];
            //cохраняем количество оставшихся запросов в Redis по ключу remainingRequests
            await client.set("remainingRequests", response.headers["x-ratelimit-remaining"]);
            //сохраняем значение с ключом, который включает текущую временную метку и строку "nasa", и устанавливает время жизни ключа на 3600 секунд
            await client.setEx(Date.now()+"nasa", 3600, Date.now()+"");
            //выводим заголовки ответа в консоль
            console.log(response.headers);
            //cобираем данные по частям из ответа API и сохраняем их в переменную data
            response.on("data", (chunk) => {
                data += chunk;
            });
            // обрабатываем завершение получения данных из API
            //когда все данные получены, запускаем обработчик события end
            response.on("end", async () => {
                await client.set(date, JSON.stringify(data));
                //сохраняем данные в Redis с ключом date и устанавливается время жизни ключа на 86400 секунд (24 часа)
                await client.expire(date, 86400);
                //отправляем ответ клиенту с полученными данными и количеством запросов за последний час
                res.send({data, count: requestsPerHour});
            });
        });
    }

})
//получаем значение порта или устаналвливаем дефолтное значение
const port = process.env.PORT || 5501;
//запускаем сервер
app.listen(port, function() {
    //выводим в консоль информацию
    console.log(`Server is running on http://localhost:${port}`);
});

