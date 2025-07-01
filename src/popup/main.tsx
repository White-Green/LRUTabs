import React from 'react';

export const Main: React.FC = () => {
  const [tabData, setTabData] = React.useState<any[]>([]);
  const [regex, setRegex] = React.useState('');

  React.useEffect(() => {
    const load = () => {
      chrome.storage.local.get('tab_data', ({ tab_data }) => setTabData(tab_data || []));
    };
    load();
    const listener: typeof chrome.storage.onChanged.addListener = (changes, area) => {
      if (area === 'local' && changes.tab_data) {
        setTabData(changes.tab_data.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const move = (index: number) => () => {
    chrome.runtime.sendMessage({ move: index });
  };

  const remove = (index: number) => () => {
    chrome.runtime.sendMessage({ remove: index });
  };

  const r = new RegExp(regex);

  return (
    <div style={{
      width: 500,
      height: 600,
      display: 'flex',
      flexDirection: 'column',
      background: '#202020',
      fontSize: '1.2em'
    }}>
      <div style={{ margin: 20, marginBottom: 0, left: 0, display: 'flex' }}>
        <span style={{ marginRight: 10 }}>🔎</span>
        <input style={{ flexGrow: 2 }} type="text" onChange={t => setRegex(t.target.value)} />
      </div>
      <div className="list-group" style={{ margin: 20, overflowY: 'scroll', overflowX: 'hidden', flexGrow: 2, background: 'whitesmoke' }}>
        {tabData
          .map((tab, i) => ({ ...tab, index: i }))
          .filter(tab => tab.window_id === undefined && (r.test(tab.title) || r.test(tab.url)))
          .map(({ url, title, index }) => (
            <div key={index} className="list-group-item" style={{ whiteSpace: 'nowrap', margin: 5 }}>
              <button type="button" className={['btn', 'btn-danger']} onClick={remove(index)}>❌</button>
              <a style={{ marginLeft: 10 }} onClick={move(index)}>{`${title} - ${url}`}</a>
            </div>
          ))
          .reverse()}
      </div>
    </div>
  );
};
