const flowChartService = require('../services/flowChartServe');

exports.createFlowchart = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || text.length === 0) {
            return res.status(400).json({ error: 'Code text is required' });
        }

        const mermaidCode = await flowChartService.generateFlowChart(text);
        res.status(200).json({ mermaidCode });
    } catch (error) {
        console.error('Error generating architecture diagram:', error);
        res.status(500).json({ error: 'Failed to generate architecture diagram' });
    }
};
