# Word导出验证

`python tests/verify_word_export.py`

依赖：Python3、playwright、python-docx、lxml及Chromium（默认/usr/bin/chromium）。
脚本启动临时HTTP服务，实际调用68个模块的导出入口，下载并用python-docx读取文档。
验证原生OOXML包、A4页尺寸、固定表格总宽不超版心、中文字体、上下标和页脚。
设置WORD_SAMPLES_DIR可保留样例；默认保存到/tmp/struct-calc-word-samples。

2026-10-07：68个默认模块导出全部通过；现有独立计算回归也通过。
修正叠合构件两阶段模块缺失buildStageBook导致的导出异常，使用统一模板完整保留当前参数、结果及过程。

这些检查不等同于在所有版本Word/WPS中的视觉验证；当前执行环境未安装这两款应用。
