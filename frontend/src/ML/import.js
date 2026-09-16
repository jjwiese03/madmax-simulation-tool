import evaluateText from "./parser_model.js"

const modal = document.getElementById('file-upload-modal')

const file_input = document.getElementById("file-input");
const apply = document.getElementById("apply");
const submit = document.getElementById("submit");
const discard = document.getElementById("discard");


const addDiscsParser = (TextEvaluation) => {

    // validate TextEvaluation
    if (TextEvaluation["position"].length != 0) {
        eps = (TextEvaluation["position"].length == 0) ? 24 : TextEvaluation["position"].length;

        window.discplot.discConfig.addMultipleDiscs(TextEvaluation["position"], TextEvaluation["width"], eps)
    }

}

submit.addEventListener("click", async () => {
    const text = document.getElementById('paste-data-input').value
    
    if (text == "") {
        alert("Fill in the text field so that data can be submitted.")
        return;
    };
    
    modal.style.display = "block"
    document.getElementById("examine-data").innerHTML = "<div class='loader' style='justify-self: center;' ></div>"


    const data = await evaluateText(text);


    var examinationText = ""
    for (const [key, value] of Object.entries(data)) {
        (value.length != 0) && (examinationText += `${key}: ${value} \n`);
    }

    document.getElementById("examine-data").innerText = examinationText

    apply.onclick = () => {
        addDiscsParser(data);
        modal.style.display = "none";
    }
});


document.getElementById("file-input").addEventListener("change", function () { 
    const file = this.files[0]; 
    if (!file) { return; } 
    
    const reader = new FileReader(); 
    reader.onload = function (event) { 
        document.getElementById("paste-data-input").value = event.target.result; 
    }; 
    
    reader.readAsText(file); 
});


