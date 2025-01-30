/****************************************************************************************
 * 
 * Espacios de nombres
 * 
 * *************************************************************************************/

var Go = Go || {};
Go.Ui = Go.Ui || {};
Go.Ui = Go.Ui || {};
Go.Context = Go.Context || {};
Go.Sign = Go.Sign || {};
Go.Sign.AfterSyncs = Go.Sign.AfterSyncs || {};
Go.Panel = Go.Panel || {};
Go.Panel.AfterSyncs = Go.Panel.AfterSyncs || {};

/****************************************************************************************
 * 
 * Go.Ui: Funcionalidades de la interfaz de usuario.
 * 
 ****************************************************************************************/

/**
 * Mueve el foco al control con el id indicado si se pulsa enter.
 * @param {any} event Id de siguiente control
 * @param {any} id Id de siguiente control
 */
Go.Ui.TabOnKeyEnter = function (event, id) {

    if (!event)
        event = window.event;

    var keyCode = 'which' in event ? event.which : event.keyCode;

    switch (keyCode) {
        case 13:

            var target = document.getElementById(id);
            target.focus();

            if ("select" in target)
                target.select();


            event.preventDefault();
            break;
        case 27:
            event.target.value = "";
            break;
    }

};

/****************************************************************************************
 *
 * Go.Sign: Formulario de acceso.
 *
 ****************************************************************************************/

/**
 * Contexto del formulario de acceso
 * */
Go.Sign.GetDefaultContext = function(){

    return {
        Credentials: {
            UserID: null,
            UserPass: null
        }
    }

};

/**
 * Se ejecuta cuando la vista se sincroniza
 * con el modelo.
 * @param {any} binding Enlace que desencadena la
 * sincronización.
 */
Go.Sign.AfterSync = function (binding) {

    var bindingPath = binding.GetPath();

    if (Go.Sign.AfterSyncs[bindingPath])
        if (typeof Go.Sign.AfterSyncs[bindingPath] === "function")
            Go.Sign.AfterSyncs[bindingPath](binding);

};

/**
 * Crea el modelo para el formulario de autenticación.
 * */
Go.Sign.CreateModel = function () {

    Go.Context.Sign = Go.Sign.GetDefaultContext();

    Go.Sign.Model = new Wefinz.Pages.Model({
        Context: Go.Context,
        AfterSync: Go.Sign.AfterSync,
        RenderManagers: {
        },
        ConvertManagers: {
        },
    });

};

/**
 * Inicializa la vista.
 * @param {any} context Contexto modelo.
 */
Go.Sign.InitializeView = function () {
   
    Go.Sign.CreateModel(Go.Sign.Context);
    Go.Sign.Model.Render();
   
};

/**
 * Crea un nuevo usuario
 * @param {any} user
 * @param {any} pass
 */
Go.Sign.CreateUser = async function (user, pass) {

    // Verificamos que se ha introducido una dirección de correo.
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    var isValidEmail = re.test(user);

    if (!isValidEmail) 
       return alert("Introduce una dirección de correo electrónico válida en el campo de usuario.");

    if (pass.length < 5) 
        return alert("Introduce una contraseña de al menos 5 caracteres.");

    document.querySelector(".bi.bi-key").classList.add("d-none");
    document.querySelector(".spinner-border.spinner-border-sm.d-none").classList.remove("d-none");

    var newUser = { UserID: user, Password: pass };

    const resultCreateUser = await Kivu.Community.Members.Users.AwCreate(newUser);

    document.querySelector(".bi.bi-key.d-none").classList.remove("d-none");
    document.querySelector(".spinner-border.spinner-border-sm").classList.add("d-none");

    if (resultCreateUser.ResultCode !== 0)
        return alert("Ha ocurrido un error: " + resultCreateUser.ResultMessage);

    Go.Sign.OpenModalUserActivation();


};

/**
 * Evento onclick del botón entrar.
 * */
Go.Sign.ButtonEnter = async function () {

    try {

        document.getElementById("spinnerBtEnter").classList.remove("d-none");       

        var ctx = Go.Sign.Model.GetContext();

        Go.Sign.Sessions = await Kivu.Client.Open(ctx.Sign.Credentials.UserID,
            ctx.Sign.Credentials.UserPass);
        var error = null;

        for (var session of Go.Sign.Sessions)
        {
            if (session.ResultCode !== 0) {
                error = session;
                break;
            }

        }

        if (error) {

            switch (error.ResultCode) {

                case 999:
                case 601:
                    // No existe el usuario
                    Go.Sign.CreateUser(ctx.Sign.Credentials.UserID,
                        ctx.Sign.Credentials.UserPass);
                    break;

                case 605:
                    Go.Sign.OpenModalUserActivation();
                    break;

                case 602:
                    // Pass incorrecto
                    alert(`🛑 Contraseña incorrecta para el usuario ${ctx.Sign.Credentials.UserID}`);
                    document.getElementById("Sign.Credentials.UserPass").focus();
                    break;

                default:
                    alert("🛑 Ha sucedido algún error.")
                    break;
            }

            document.getElementById("spinnerBtEnter").classList.add("d-none");

        }
        else {
            // Acceso correcto
            document.getElementById("spinnerBtEnter").classList.add("d-none");
            document.querySelector(".form-signin").classList.toggle("d-none");            

            Go.Panel.InitializeView();

            document.querySelector(".form-panel").classList.toggle("d-none");

            // Reviso si existe el usuario

            var filterSet = {
                Offset: 0,
                Count: -1,
                Filters: []
            };

            const resultGetUserFacturae = await Kivu.Isolutions.Facturae.Users.AwGetFilteredList(filterSet);

            if (resultGetUserFacturae.ResultCode !== 0)
                return alert("Ha ocurrido un error: " + resultGetUserFacturae.ResultMessage);

            Go.Context.Sign.Facturae = {};

            if (resultGetUserFacturae.Items.length === 0) {                

                Go.Context.Sign.Facturae.User = {
                    UserID: Go.Context.Sign.Credentials.UserID,
                    UserName: null,
                    BankAccount: null,
                    UserServer: Kivu.Client.Clusters.Isolutions.GetServer("facturae_manager").Server,
                    UserServerPort: parseInt(Kivu.Client.Clusters.Isolutions.GetServer("facturae_manager").Port),
                    UserRoleID: "FREE"
                };

                // Lo doy de alta
                const resultCreateUserFacturae = await Kivu.Isolutions.Facturae.Users.AwCreate(Go.Context.Sign.Facturae.User);

                if (resultCreateUserFacturae.ResultCode !== 0)
                    return alert("Ha ocurrido un error: " + resultCreateUserFacturae.ResultMessage);

            }
            else {

                Go.Context.Sign.Facturae.User = resultGetUserFacturae.Items[0];
                const sellers = await Go.Panel.GetSellers();
                Go.Context.Panel.Sellers = sellers;

                Go.Panel.FillSellers(sellers);

                if (sellers.length > 0) {

                    var binding = Go.Panel.Model.GetBindings().reduce((prev, binding) => (binding.GetPath() === "Panel.SellerID") ? binding : prev);
                    binding.GetHtmlElement().value = sellers[0].SellerID;
                    binding.Sync();

                }                

            }

            Go.Panel.Notify(Go.Panel.GetMessage("Go.Panel.Hello"));

        }
          
    }
    catch (error) {

        document.getElementById("spinnerBtEnter").classList.add("d-none");
        alert(error);

    }

};

/**
 * Verifica si se trata de una activación de usuario y
 * en su caso la ejecuta.
 * */
Go.Sign.CheckActivation = function () {

    let location = (document.location + "").split("?");

    if (location.length < 2)
        return false;

    let paramPairs = location[1].split("&");

    if (paramPairs.length !== 7)
        return false;

    for (var params = {}, i = 0; i < paramPairs.length; i++) {

        let keyValuePair = paramPairs[i].split("=");

        if (2 !== keyValuePair.length)
            return false;

        params[keyValuePair[0]] = keyValuePair[1];
    }

    // Cambiar los nombres de las variables por los de settings
    let url = params.protocol + "://" + params.servername + ":" + params.port + "/" + params.root +
        "/Community/Members/?" + params.actiontag + "=Users.Activate";

    let requestText = `UserID=${params.userid}&Key=${params.key}`;

    Go.Context.Sign.Credentials.UserID = params.userid;

    var request = new XMLHttpRequest;

    request.onreadystatechange = function () {
        if (4 === this.readyState && 200 === this.status) {
            var e = JSON.parse(this.responseText);

            if (e.ResultCode == 0) {
                Go.Sign.Model.Render();
                Go.Sign.OpenModalUserActivationOk();                
                return true;
            }

            return false;
        }
    };
    request.open("POST", url, true);
    request.send(requestText);

};

/**
 * Abre el formulario de activación de cuenta
 * de usuario.
 * */
Go.Sign.OpenModalUserActivation = function () {

    Go.Sign.ModalUserActivation = new bootstrap.Modal(document.getElementById('modalUserActivation'));
    Go.Sign.ModalUserActivation.show();

};

/**
 * Abre el formulario de activación de cuenta
 * de usuario.
 * */
Go.Sign.CloseModalUserActivation = function () {

    Go.Sign.ModalUserActivation.hide();

};

/**
 * Abre el formulario de activación de cuenta
 * de usuario satisfactoria.
 * */
Go.Sign.OpenModalUserActivationOk = function () {

    Go.Sign.ModalUserActivationOk = new bootstrap.Modal(document.getElementById('modalUserActivationOk'));
    Go.Sign.ModalUserActivationOk.show();

};

/**
 * Abre el formulario de activación de cuenta
 * de usuario satisfactoria.
 * */
Go.Sign.CloseModalUserActivationOk = function () {

    Go.Sign.ModalUserActivationOk.hide();
    setTimeout(() => { document.getElementById("Sign.Credentials.UserPass").focus(); }, 200);

};

/**
 * Resetea el usuario.
 * */
Go.Sign.ResetUser = async function () {    
        
    var userToReset = {
        UserID: Go.Context.Sign.Credentials.UserID,
        Password: Go.Context.Sign.Credentials.UserPass
    };

    const resultResetUser = await Kivu.Community.Members.Users.AwReset(userToReset);

    if (resultResetUser.ResultCode !== 0)
        return alert("Ha ocurrido un error: " + resultResetUser.ResultMessage);

    Go.Sign.CloseModalUserActivation();

};

/****************************************************************************************
 *
 * Go.Panel: Panel de trabajo.
 *
 ****************************************************************************************/

/**
 * Mensajes de la aplicación en español.
 * */
Go.Panel.MessagesEs = {
    "Go.Panel.ButtonPost.fetch": "Se ha producido un error al enviar la petición.",
    "Go.Panel.ButtonPost.qrOk": "✔ Puede utilizar la url de validación ya que la factura ha sido creada con CSV: {0}",
    "Go.Panel.ButtonPost.qrKo": "⚠ La factura no ha sido envíada por lo que la url de validación no será válida",
    "Go.Panel.GetSellers.Ok": "Relación de vendedores recuperada con éxito.",
    "Go.Panel.GetSellers.Ko": "Error obteniendo vendedores: {0}",
    "Go.Panel.TestQr": "Ahora puede probar la llamada POST de obtención de código QR desde el panel de pruebas.",
    "Go.Panel.TestSend": "Ahora puede probar la llamada POST de envío de facturas desde el panel de pruebas.",
    "Go.Panel.Hello": "Bienvenido a nuestra API REST."
};

Go.Panel.MessagesEn = {
    "Go.Panel.ButtonPost.fetch": "Request error.",
    "Go.Panel.ButtonPost.qrOk": "✔ You can use the validation url since the invoice has been created with CSV: {0}",
    "Go.Panel.ButtonPost.qrKo": "⚠ The invoice has not been sent so the validation url will not be valid",
    "Go.Panel.GetSellers.Ok": "Issures retrieved OK.",
    "Go.Panel.GetSellers.Ko": "Error retrieving issuers: {0}",
    "Go.Panel.TestQr": "Now you can test QR code POST call from test panel.",
    "Go.Panel.TestSend": "Now you can test send invoice POST call from test panel.",
    "Go.Panel.Hello": "Welcome to Verifactu API REST."
};

Go.Panel.MessagesDic = {
    "es": Go.Panel.MessagesEs,
    "en": Go.Panel.MessagesEn
};

/**
 * Resulve mensajes.
 * @param {any} id
 * @param {any} args
 */
Go.Panel.GetMessage = function (id, args) {

    var text = Go.Panel.Messages[id];

    if (!args)
        return text;

    return text.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined'
            ? args[number]
            : match
            ;
    });

};

Go.Panel.EpModes = {
    "00": {        
        Title: "Endpoint creación de facturas",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Create",
        Input: {
            "ServiceKey": null,
            "Status": "POST",
            "InvoiceType": "F1",
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "RelatedPartyID": "B44531218",
            "RelatedPartyName": "WEFINZ SOLUTIONS SL",
            "Text": "SERVICIOS INFORMATICOS",
            "TaxItems": [
                { "TaxScheme": "01", "TaxType": "S1", "TaxRate": 21, "TaxBase": 11.99, "TaxAmount": 2.52 }
            ]
        }
    },
    "01": {
        Title: "Endpoint anulación facturas",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Cancel",
        Input: {
            "ServiceKey": null,
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
        }
    },
    "02": {
        Title: "Endpoint generación código QR",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/GetQrCode",
        Input: {
            "ServiceKey": null,
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "TaxItems": [
                { "TaxBase": 11.99, "TaxAmount": 2.52 }
            ]
        }
    },
    "03": {
        Title: "Endpoint consulta emisores",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/GetSellers",
        Input: {
            "ServiceKey": null
        }
    },
    "04": {
        Title: "Endpoint consulta envíos realizados",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/GetFilteredList",
        Input: {
            "ServiceKey": null,
            "Offset": 0,
            "Count": -1,
            "Filters": [
                { FieldName: "SellerID", Operator: "LIKE", Value: `'B12959755'` },
                { FieldName: "InvoiceDate", Operator: "LIKE", Value: `'2024-%'` },
            ]
        }
    },
    "05": {
        Title: "Endpoint creación de facturas (Ejemplo factura simplificada)",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Create",
        Input: {
            "ServiceKey": null,
            "Status": "POST",
            "InvoiceType": "F2",
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "Text": "SERVICIOS A CLIENTES VARIOS",
            "TaxItems": [
                { "TaxScheme": "01", "TaxType": "S1", "TaxRate": 21, "TaxBase": 11.99, "TaxAmount": 2.52 }
            ]
        }
    },
    "06": {
        Title: "Endpoint creación de facturas (Ejemplo recargo equivalencia)",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Create",
        Input: {
            "ServiceKey": null,
            "Status": "POST",
            "InvoiceType": "F1",
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "RelatedPartyID": "B44531218",
            "RelatedPartyName": "WEFINZ SOLUTIONS SL",
            "Text": "SERVICIOS A CLIENTES EN RECARGO DE EQUIVALENCIA",
            "TaxItems": [
                { "TaxScheme": "01", "TaxType": "S1", "TaxRate": 21, "TaxBase": 1000, "TaxAmount": 210, "TaxRateSurcharge": 5.2, "TaxAmountSurcharge": 52 }
            ]
        }
    },
    "07": {
        Title: "Endpoint creación de facturas (Ejemplo rectificativa)",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Create",
        Input: {
            "ServiceKey": null,
            "Status": "POST",
            "InvoiceType": "R1",
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "RelatedPartyID": "B44531218",
            "RelatedPartyName": "WEFINZ SOLUTIONS SL",
            "Text": "ABONO ERROR PRECIO FACTURA FRA00012",
            "TaxItems": [
                { "TaxScheme": "01", "TaxType": "S1", "TaxRate": 21, "TaxBase": -100, "TaxAmount": -21 }
            ],
            "RectificationItems": [
                { "InvoiceID": "FRA00012", "InvoiceDate": new Date(2024, 11, 5) }
            ]
        }
    },
    "08": {
        Title: "Endpoint creación de facturas (Factura a la Administración con IVA diferido)",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Create",
        Input: {
            "ServiceKey": null,
            "Status": "POST",
            "InvoiceType": "F1",
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "RelatedPartyID": "P1203200I",
            "RelatedPartyName": "AYUNTAMIENTO DE BURRIANA",
            "Text": "CONSTRUCCION NUEVAS OFICINAS",
            "OperationDate ": new Date(new Date().valueOf() + 30*24*60*60*1000),
            "TaxItems": [
                { "TaxScheme": "14", "TaxType": "S1", "TaxRate": 21, "TaxBase": 1000, "TaxAmount": 210 }
            ]
        }
    },
    "09": {
        Title: "Endpoint creación de facturas (Factura emitida no sujeta a IVA en virtud del artículo 7, 14 u otros)",
        Url: "https://facturae.irenesolutions.com:8050/Kivu/Taxes/Verifactu/Invoices/Create",
        Input: {
            "ServiceKey": null,
            "Status": "POST",
            "InvoiceType": "F1",
            "InvoiceID": null,
            "InvoiceDate": null,
            "SellerID": "B12959755",
            "CompanyName": "IRENE SOLUTIONS SL",
            "RelatedPartyID": "ZZZZZZZZ",
            "RelatedPartyName": "CLIENTE EXTRANJERO SERVICIOS INFORMATICOS",
            "RelatedPartyIDType": "06",
            "CountryID": "US",
            "Text": "SERVICIOS INFORMATICOS",
            "TaxItems": [
                {"Tax": "05", "TaxType": "N1", "TaxBase": 1000 }
            ]
        }
    }

};

/**
 * Muestra una notificación al usuario.
 * @param {any} msg
 */
Go.Panel.Notify = function (msg) {


    if (Go.Panel.ToastNotif) {

        var toastBody = document.querySelector(".toast-body");
        toastBody.innerHTML = msg;
        Go.Panel.ToastNotif.show();
    }

};

/**
 * Contexto del formulario de acceso
 * */
Go.Panel.GetDefaultContext = function () {

    let u = Go.Context.Sign.Credentials.UserID, p = Go.Context.Sign.Credentials.UserPass;
    let sk = u && p ? window.btoa(`${u}:${p}`) : null;    

    var defaultEpMode = "00";

    var mode = Go.Panel.EpModes[defaultEpMode];

    mode.Input.ServiceKey = sk;
    mode.Input.InvoiceID = `FRTEST${new Date().valueOf()}`;
    mode.Input.InvoiceDate = new Date();

    var input = mode.Input;

    var json = JSON.stringify(input, undefined, 4);

    Go.Panel.EpModes["02"].Input.ServiceKey = sk;
    Go.Panel.EpModes["02"].Input.InvoiceID = `FRTEST${new Date().valueOf()}`;
    Go.Panel.EpModes["02"].Input.InvoiceDate = new Date();

    var jsonQr = JSON.stringify(Go.Panel.EpModes["02"].Input, undefined, 4);

    return {
        Initial: null,
        UserID: Go.Context.Sign.UserID,
        ServiceKey: sk,
        ServiceKeyC: sk,
        ServiceKeyVb: sk,
        Request: {
            Url: mode.Url,
            Body: json,
            Response: null,
            BodyQr: jsonQr,
            BodySend: json
        },
        EpMode: defaultEpMode,
        Title: mode.Title,
        Sellers: [],
        SellerID: null,
        Periods: [],
        PeriodID: null,
        Invoices: []
    }
};

/**
 * Se ejecuta tras una sincronización del la vista con
 * el modelo.
 * @param {any} binding Enlace que ha generado la sincronización.
 */
Go.Panel.AfterSync = function (binding) {

    var bindingPath = binding.GetPath();

    if (Go.Panel.AfterSyncs[bindingPath])
        if (typeof Go.Panel.AfterSyncs[bindingPath] === "function")
            Go.Panel.AfterSyncs[bindingPath](binding);

};

/**
 * Copia la ServiceKey al protapapeles.
 * */
Go.Panel.ButtonCopyServiceKeyToClipboard = function () {

    navigator.clipboard.writeText(Go.Context.Panel.ServiceKey);

};

/**
 * Crea el modelo para el panel de control.
 * */
Go.Panel.CreateModel = function () {

    Go.Context.Panel = Go.Panel.GetDefaultContext();

    Go.Panel.Model = new Wefinz.Pages.Model({
        Context: Go.Context,
        AfterSync: Go.Panel.AfterSync,
        RenderManagers: {
        },
        ConvertManagers: {
        },
    });

};

/**
 * Ejecuta la consulta.
 * */
Go.Panel.ButtonPost = async function () {

    document.getElementById("timer").classList.remove("d-none");

    var ctx = Go.Panel.Model.GetContext();

    await fetch(ctx.Panel.Request.Url, { method: 'post', body: ctx.Panel.Request.Body }).then((response) => {

        if (!response.ok && [601, 602, 605, 607].indexOf(response.status) === -1)
            throw Error(response.statusText);

        Go.Panel.Notify(Go.Panel.GetMessage("Go.Panel.ButtonPost.fetch"));

        return response;

    }).then(function (response) {

        return response.json();


    }).then(async (result) => {

        var json = JSON.stringify(result, undefined, 4);
        ctx.Panel.Request.Response = json;  
        Go.Panel.Model.Render();
        document.getElementById("timer").classList.add("d-none");
        document.getElementById("btJson").classList.remove("disabled");

        var src = (Go.Panel.Model.GetContext().Panel.EpMode === "02") ? result.Return : result.Return.QrCode;
        var txt = (Go.Panel.Model.GetContext().Panel.EpMode === "02") ? Go.Panel.GetMessage("Go.Panel.ButtonPost.qrKo") :
            (result.Return.CSV ? Go.Panel.GetMessage("Go.Panel.ButtonPost.qrOk", [result.Return.CSV]) : Go.Panel.GetMessage("Go.Panel.ButtonPost.qrKo"));


        if (src) {

            // Mostramos el código Qr
            document.getElementById("imgQr").src = `data:image/bmp;base64,${src}`;
            document.getElementById("txQr").innerHTML = txt;

            if (!Go.Panel.ModalQr)
                Go.Panel.ModalQr = new bootstrap.Modal(document.getElementById('modalQr'));

            Go.Panel.ModalQr.show();

        }

        // Refresco vendedores
        const sellers = await Go.Panel.GetSellers();

        Go.Context.Panel.Sellers = sellers;

        Go.Panel.FillSellers(sellers);

        if (sellers.length > 0) {

            var binding = Go.Panel.Model.GetBindings().reduce((prev, binding) => (binding.GetPath() === "Panel.SellerID") ? binding : prev);
            binding.GetHtmlElement().value = sellers[0].SellerID;
            binding.Sync();

        }



        // Refresco facturas
        const invoices = await Go.Panel.GetInvoices(ctx.Panel.SellerID, ctx.Panel.PeriodID);

        ctx.Panel.Invoices = invoices;

        Go.Panel.FillInvoices(invoices);


    }).catch(function (error) {

        alert(`Woops, there was an error making the request:\n${url}\n${error}`);
        Go.Panel.Notify(Go.Panel.GetMessage("Go.Panel.ButtonPost.fetch"));

        return false;

    });

    return true;

};

/**
 * Resupera vendedores en el sistema.
 * */
Go.Panel.GetSellers = async function () {

    const result = await Kivu.Taxes.Verifactu.Invoices.AwGetSellers({});

    if (result.ResultCode !== 0) {

        alert(Go.Panel.GetMessage("Go.Panel.GetSellers.Ko", [result.ResultMessage]));
        return [];
    }

    Go.Panel.Notify(Go.Panel.GetMessage("Go.Panel.GetSellers.Ok"));

    return result.Return;

};

/**
 * Descarga el fichero json
 * */
Go.Panel.ButtonDownload = function () {

    var ctx = Go.Panel.Model.GetContext();
    var input = JSON.parse(ctx.Panel.Request.Body);
    var fileName = `${input.InvoiceID}.json`;

    var bytes = window.btoa(ctx.Panel.Request.Response);
    var byteChars = atob(bytes);
    var byteNums = new Array(byteChars.length);

    for (let i = 0; i < byteNums.length; i++)
        byteNums[i] = byteChars.charCodeAt(i);

    var bytes = new Uint8Array(byteNums);
    var blob = new Blob([bytes], { type: "text/plain" });

    if (navigator.msSaveOrOpenBlob) {

        navigator.msSaveOrOpenBlob(blob, fileName);
        return;
    }

    var downloadLink = document.createElement("a");
    var url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = fileName;

    /*
     * Actually download PDF
     */
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

};

/**
 * Muestra una sección deteminada.
 * @param {any} id Sección a mostrar
 */
Go.Panel.Show = function (id) {

    var ids = ["formQuickstart", "formTest", "formFiles", "formDoc"];

    // Visible
    for (cid of ids) {

        var el = document.getElementById(cid);

        if (el.id === id && el.classList.contains("d-none"))
            el.classList.remove("d-none");
        else if (el.id !== id && !el.classList.contains("d-none"))
            el.classList.add("d-none");

    };

    // Enlace activo
    for (cid of ids) {

        var lk = document.getElementById(`_${cid}`);

        if (lk.id === `_${id}` && !lk.classList.contains("active"))
            lk.classList.add("active");
        else if (lk.id !== `_${id}` && lk.classList.contains("active"))
            lk.classList.remove("active");

    };

};

/**
 * Rellena select de vendedores.
 * @param {any} sellers Lista de vendedores.
 */
Go.Panel.FillSellers = function (sellers) {

    Go.Panel.FillSelect("Panel.SellerID", sellers, "SellerID", "CompanyName");
   
};

/**
 * Rellena select de vendedores.
 * @param {any} sellers Lista de vendedores.
 */
Go.Panel.FillPeriods = function (periods) {

    Go.Panel.FillSelect("Panel.PeriodID", periods, "PeriodID", "PeriodID");

};

/**
 * Rellena select.
 * @param {any} selectId Id. del elmento html select a rellenar.
 * @param {any} items Lista de intems a incluir en el select. 
 * @param {any} valueName Nombre de la propiedad de item a incluir en value.
 * @param {any} textName Nombre de la propiedad item a incluir en texto.
 */
Go.Panel.FillSelect = function (selectId, items, valueName, textName) {

    var select = document.getElementById(selectId);

    // Vacio
    select.innerHTML = "";

    for (var item of items) {

        var opt = document.createElement("option");
        opt.value = item[valueName];
        opt.innerHTML = item[textName];
        select.appendChild(opt);

    };
};

/**
 * Manejador evento AfterSync para Panel.EpMode.
 * @param {any} bindingPath Elemento binding que desencadena el evento.
 */
Go.Panel.AfterSyncs["Panel.EpMode"] = function (binding) {

    var modeCod = binding.GetModelValue();

    var ctx = Go.Panel.Model.GetContext();

    var mode = Go.Panel.EpModes[modeCod];

    ctx.Panel.Request.Url = mode.Url;
    mode.Input.ServiceKey = ctx.Panel.ServiceKey;

    if (modeCod !== "03" && modeCod !== "04") {
        mode.Input.InvoiceID = `FRTEST${new Date().valueOf()}`;
        mode.Input.InvoiceDate = new Date();
    }

    ctx.Panel.Request.Body = JSON.stringify(mode.Input, undefined, 4);
    ctx.Panel.Title = mode.Title;

    Go.Panel.Model.Render();

};

/**
 * Manejador evento AfterSync para Panel.SellerID.
 * @param {any} bindingPath Elemento binding que desencadena el evento.
 */
Go.Panel.AfterSyncs["Panel.SellerID"] = function (binding) {

    var sellerID = binding.GetModelValue();

    var ctx = Go.Panel.Model.GetContext();

    ctx.Panel.PeriodID = null;
    ctx.Panel.Periods = [];

    for (var seller of ctx.Panel.Sellers) {

        if (seller.SellerID === sellerID) {

            ctx.Panel.Periods = seller.Periods;
            break;

        }

    }

    Go.Panel.FillPeriods(ctx.Panel.Periods);

    if (ctx.Panel.Periods.length > 0) {

        var binding = Go.Panel.Model.GetBindings().reduce((prev, binding) => (binding.GetPath() === "Panel.PeriodID") ? binding : prev);
        binding.GetHtmlElement().value = ctx.Panel.Periods[0].PeriodID;
        binding.Sync();

    }

};

/**
 * Manejador evento AfterSync para Panel.SellerID.
 * @param {any} bindingPath Elemento binding que desencadena el evento.
 */
Go.Panel.AfterSyncs["Panel.PeriodID"] = async function (binding) {

    var periodID = binding.GetModelValue();

    var ctx = Go.Panel.Model.GetContext();

    const invoices = await Go.Panel.GetInvoices(ctx.Panel.SellerID, periodID);

    ctx.Panel.Invoices = invoices;

    Go.Panel.FillInvoices(invoices);

    Go.Panel.Model.Render();

};

/**
 * Abre test en un modo determinado.
 * @param {any} epMode Código de modo.
 */
Go.Panel.Test = function (epMode) {

    var ctx = Go.Panel.Model.GetContext();
    ctx.Panel.EpMode = epMode;

    var mode = Go.Panel.EpModes[ctx.Panel.EpMode];

    ctx.Panel.Request.Url = mode.Url;
    mode.Input.ServiceKey = ctx.Panel.ServiceKey;
    mode.Input.InvoiceID = `FRTEST${new Date().valueOf()}`;
    mode.Input.InvoiceDate = new Date();

    ctx.Panel.Request.Body = JSON.stringify(mode.Input, undefined, 4);
    ctx.Panel.Title = mode.Title;

    Go.Panel.Model.Render();

    Go.Panel.Show('formTest');

};

/**
 * Abre el entorno de test con la prueba de obtención de QR.
 * */
Go.Panel.TestQr = function (epMode) {

    Go.Panel.Test("02");
    Go.Panel.Notify(Go.Panel.GetMessage("Go.Panel.TestQr"));

};

/**
 * Abre el entorno de test con la prueba de alta factura.
 * */
Go.Panel.TestSend = function (epMode) {

    Go.Panel.Test("00");
    Go.Panel.Notify(Go.Panel.GetMessage("Go.Panel.TestSend"));

};

/**
 * Recupera las facturas de un vendedor y periodo determinado.
 * @param {any} sellerID Id. vendedor.
 * @param {any} periodID Id. periodo.
 */
Go.Panel.GetInvoices = async function (sellerID, periodID) {

    const result = await Kivu.Taxes.Verifactu.Invoices.AwGetFilteredList({
        Offset: 0,
        Count: -1,
        Filters: [
            { FieldName: "SellerID", Operator: "LIKE", Value: `'${sellerID}'` },
            { FieldName: "InvoiceDate", Operator: "LIKE", Value: `'${periodID}-%'` },
        ]
    });

    if (result.ResultCode !== 0) {

        alert(`Error obteniendo vendedores: ${result.ResultMessage}`);
        return [];
    }

    return result.Items;

};

/**
 * Obtiene las facturas agrupando tanto altas como anulaciones en un
 * único documento.
 * @param {any} invoices
 */
Go.Panel.GetMerged = function (invoices) { };

/**
 * Rellena la tabla de facturas.
 * @param {any} invoices
 */
Go.Panel.FillInvoices = function (invoices) {

    var tbody = document.getElementById("invoices");

    tbody.innerHTML = "";

    for (var invoice of invoices)
        tbody.innerHTML += `<tr><th scope="row">${invoice.InvoiceID}</th><td>${invoice.InvoiceDate.replace("T", " ")}</td><td>` +
            `${invoice.RelatedPartyID||""}</td><td>${invoice.RelatedPartyName||""}</td><td style="text-align: right;">${invoice.TotalAmount}</td><td>` +
            `${invoice.CSV ? invoice.CSV : invoice.ErrorCode + " " + invoice.ErrorDescription}</td></tr>\n`;

};

/**
 * Filtra una colección de facturas.
 * @param {any} invoices Colección a filtrar.
 * @param {any} filter Filtro.
 */
Go.Panel.FilterInvoices = function (input) {

    var ctx = Go.Panel.Model.GetContext();
    var filteredInvoices = ctx.Panel.Invoices;

    var text = input.value;

    if (text) {

        var words = text.split(' ');        

        var filteredInvoices = ctx.Panel.Invoices.filter((invoice) => {

            var selected = false;
            var txInvoice = `${invoice.InvoiceID}${invoice.InvoiceDate.replace("T", " ")}` +
                `${invoice.RelatedPartyID}${invoice.RelatedPartyName}${invoice.TotalAmount}` +
                `${invoice.CSV ? invoice.CSV : invoice.ErrorCode + " " + invoice.ErrorDescription}`.toUpperCase();

            words.forEach((word) => {

                if (txInvoice.includes(word.toUpperCase()))
                    selected = true;
            });

            return selected ? invoice : null;

        });

    }

    Go.Panel.FillInvoices(filteredInvoices);

};


/**
 * Inicializa la vista.
 * @param {any} context Contexto modelo.
 */
Go.Panel.InitializeView = function () {

    Go.Panel.CreateModel();
    Go.Context.Panel.Initial = Go.Context.Sign.Credentials.UserID.substr(0, 1).toUpperCase();
    Go.Context.Panel.UserID = Go.Context.Sign.Credentials.UserID;
    Go.Panel.Model.Render();

};

/****************************************************************************************
 *
 * Go: Inicialización de la página.
 *
 ****************************************************************************************/

!function Initialize() {    

    Go.Sign.InitializeView();

    Go.Sign.CheckActivation();
   
    // Inicializa tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // Inicializa toasts
    var toastElList = [].slice.call(document.querySelectorAll('.toast'))
    var toastList = toastElList.map(function (toastEl) {
        return new bootstrap.Toast(toastEl, { delay: 10000})
    });

    if (toastList.length > 0)
        Go.Panel.ToastNotif = toastList[0];

    document.getElementById("Sign.Credentials.UserID").focus();

    if (Go.Panel.ToastNotif)
        Go.Panel.ToastNotif.show();

    // Idioma
    Go.Panel.Messages = Go.Panel.MessagesDic[document.documentElement.lang];

    if (!Go.Panel.Messages)
        Go.Panel.Messages = Go.Panel.MessagesEs;

}();



