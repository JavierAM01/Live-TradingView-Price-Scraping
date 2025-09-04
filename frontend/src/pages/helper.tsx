import styles from '../css/helper.module.css';


const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }}>
    <div style={{
      border: '2px solid #f3f3f3', // Light grey border
      borderTop: '2px solid gray', // Blue top border (creates the "moving" effect)
      borderRadius: '50%', // Make it a circle
      width: '20px',
      height: '20px',
      animation: 'spin 1s linear infinite' // CSS animation for spinning
    }}></div>
    {/* Define the spin animation using a style tag or in a CSS file */}
    <style>
      {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
    </style>
  </div>
);




const WarningPopup = ({ title, message, onClick } : { title: string, message: string, onClick: () => void }) => {
  return (
    <div className={styles.popupOverlay}>
      <div className={styles.popup}>
        <div className={styles.popupTitleBar}>
          <h2 className={styles.popupTitle}>{title}</h2>
          <button onClick={onClick} className={styles.closeBtn}>
            &times;
          </button>
        </div>
        <div className={styles.popupContent}>
          <svg className={styles.warningIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className={styles.popupMessage}>{message}</p>
        </div>
        <div className={styles.popupActions}>
          <button className={`${styles.btn} ${styles.btnOk}`} onClick={onClick}>OK</button>
        </div>
      </div>
    </div>
  );
};


export { LoadingSpinner, WarningPopup };