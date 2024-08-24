
let choosenFile = document.getElementById('fileUploaded')
let resTxt = null;


document.getElementById('submit').addEventListener('click', async () => {
    // Check if the user is online
    if (!navigator.onLine) {
        alert('Please connect to the internet to use this app.');
        return; // Stop execution if not online
    }
    
    let overlay = document.querySelector(".overlay")
    overlay.style.display = "flex"
    try{
        const filePathEntry = choosenFile.files[0].path;
        // Update with your file path
        const resultTexts = await window.electronAPI.getTextResult(filePathEntry);
       
        const selectedRadio = document.querySelector('.radio-group input[type="radio"]:checked');
        let level = await selectedRadio.value
       
        
        if (window.electronAPI) {
                 console.log('electronAPI is available');
                try {
                    const result = await window.electronAPI.getFunctionResult(resultTexts,level); 
                    resTxt = result;
                   
                    
                 } catch (error) {
                     console.error('Error accessing function from main process:', error);
                 }
            } else {
                console.error('electronAPI is not available');
            }


            // Replace tab characters with spaces to avoid encoding issues
            resTxt = resTxt.replace(/\t/g, ' ');
    
       // To create an output file with the same name of the input file:
       let fileName_pth = filePathEntry.substring(0, filePathEntry.lastIndexOf('.'));
       
        
        // create the pdf using the text
        try{
        const filePathOut = await window.electronAPI.createPdf(resTxt,fileName_pth,level);
        alert(`PDF created at: ${filePathOut}`);
        }
        catch(error){
            console.error('Error creating PDF:', error);
            alert('Failed to create PDF. Please try again.');
        }
       
    }
    catch(error){
            alert("Please upload the file and select the level correctly ")
    }
    finally {
        overlay.style.display = "none"
    }
});
