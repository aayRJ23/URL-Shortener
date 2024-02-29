import "./App.css";
import { useState } from "react";

function App() {
  const [currentURL, setCurrentURL] = useState("");
  const [shortURL, setShortURL] = useState("");
  const [done, setDone] = useState(false);

  const handleRedirect = () => {
    const url = `http://localhost:4010/${shortURL}`;
    window.location.href = url;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (currentURL == "") {
      alert("Please enter the URL !");
      setDone(false);
      return;
    }

    const url = "http://localhost:4010/shorten";

    const data = {
      currentURL,
    };

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };

    fetch(url, options)
      .then((response) => {
        //display the shorted url
        // console.log(response);
        return response.json();
      })
      .then((data) => {
        //display the shorted url
        // console.log(data);
        setShortURL(data.shortedurl);
        setDone(true);
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  };

  return (
    <div className="App">
      <div className="center">
        <h1 align="center"> URL Shortener </h1>
      </div>
      <div>
        <form action="" onSubmit={handleSubmit}>
          <input
            id="url"
            type="text"
            placeholder="Enter URL"
            name="url"
            value={currentURL}
            onChange={(e) => {
              setCurrentURL(e.target.value);
            }}
          />
          <br />
          <input id="submit" type="submit" className="btn" />
        </form>
      </div>
      <br />
      <div>
        {done !== false && currentURL !== "" && (
          <div id="shortcode" className="mydiv">
            Shorted URL :
            <button className="btn2" onClick={() => handleRedirect()}>
              http://localhost:4010/{shortURL}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
