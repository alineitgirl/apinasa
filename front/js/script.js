
document.addEventListener('DOMContentLoaded', () => {
    new AirDatepicker(document.querySelector('.datepicker'), {
        autoClose: true,
        dateFormat: 'yyyy-MM-dd',
        onSelect: (date) => {
            fetch('/date', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date: date.formattedDate })
            })
            .then(response => response.json())
            .then((res) => {
                const photo = JSON.parse(res.data);
                getImageData(photo.url, photo.title, photo.explanation);
                if(res.count !== -1)
                    document.querySelector(".counter").innerHTML = "Запросов за час: " + res.count;
            })
            .catch(() => getError());
        }
    });
});

function getImageData(image, title, description){
    const main = document.querySelector('.page-main');
    main.innerHTML = `
        <div class="nasa-layout">

            <img src="${image}" alt="" class="nasa-image">
            <p class="nasa-title">${title}</p>
            <div class="nasa-description">${description}</div>

        </div>
    `
}

function getError(){
    const main = document.querySelector('.page-main');
    main.innerHTML = `
        <div class="nasa-layout">
            <p class="nasa-title">Похоже вы сделали слишком много запросов сегодня!</p>
        </div>
    `
}