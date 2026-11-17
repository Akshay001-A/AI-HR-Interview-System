export default function Recommendations({ recommendations }) {
 return <section className="panel"><span className="eyebrow">ONE STEP AT A TIME</span><h3>Your next practice goals</h3><ol className="feedback-recommendations">{recommendations.map((text,index)=><li key={index}>{text}</li>)}</ol></section>
}
