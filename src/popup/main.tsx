import React from "react";

export const Main: React.FC = () => {
    const [tab_data, setTabData] = React.useState([]);
    chrome.storage.local.get("tab_data", ({tab_data}) => setTabData(tab_data));
    const move = index => {
        return () => {
            chrome.runtime.sendMessage({move: index});
            console.log("move", index);
        };
    };
    const remove = index => {
        return () => {
            chrome.runtime.sendMessage({remove: index});
            console.log("remove", index);
        };
    };
    const [regex, setRegex] = React.useState("");
    let r = new RegExp(regex);
    return (
        <div style={{
            width: 500,
            height: 600,
            display: "flex",
            flexDirection: "column",
            background: "#202020",
            fontSize: "1.2em"
        }}>
            <div style={{margin: 20, marginBottom: 0, left: 0, display: "flex"}}>
                <span style={{marginRight: 10}}>
                    {"🔎"}
                </span>
                <input style={{flexGrow: 2}} type={"text"} onChange={(t) => setRegex(t.target.value)}/>
            </div>
            <div className={"list-group"}
                 style={{margin: 20, overflowY: "scroll", overflowX: "hidden", flexGrow: 2, background: "whitesmoke"}}>
                {tab_data
                    .map((tab, i) => {
                        return {...tab, index: i}
                    })
                    .filter(tab => tab.window_id === undefined && (r.test(tab.title) || r.test(tab.url)))
                    .map(({url, title, index}) => (
                        <div className={"list-group-item"} style={{whiteSpace: "nowrap", margin: 5}}>
                            <button type={"button"} className={["btn", "btn-danger"]} onClick={remove(index)}>❌</button>
                            <a style={{marginLeft: 10}} onClick={move(index)}>{`${title} - ${url}`}</a>
                        </div>))
                    .reverse()}
            </div>
        </div>)
};