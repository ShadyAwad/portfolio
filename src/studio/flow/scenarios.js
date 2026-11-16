const step = (node, en, ar, requires) => ({ node, text: [en, ar], requires });
const browser = (en, ar) => step('browser', en, ar);
const report = title => ({ title, queue: true, steps: [
    browser('Request a report for the selected time range.', 'اطلب تقريرًا للفترة الزمنية المحددة.'),
    step('api', 'Validate the report parameters and accept the job.', 'تحقّق من معلمات التقرير واقبل المهمة.'),
    step('queue', 'Queue the job so report generation runs outside the request.', 'أضف المهمة إلى القائمة ليُنشأ التقرير خارج الطلب.'),
    step('workers', 'Generate the report using the requested filters.', 'أنشئ التقرير باستخدام عوامل التصفية المطلوبة.'),
    browser('Show that the report is ready when processing finishes.', 'اعرض أن التقرير جاهز عند انتهاء المعالجة.')
] });

export const scenarios = {
    saas: {
        workspace: { title: ['Load workspace', 'تحميل مساحة العمل'], steps: [
            browser('Open the workspace and request its dashboard.', 'افتح مساحة العمل واطلب لوحة التحكم.'),
            step('api', 'Read the workspace request and its available context.', 'اقرأ طلب مساحة العمل وسياقه المتاح.'),
            step('auth', 'Verify the session before reading private workspace data.', 'تحقّق من الجلسة قبل قراءة بيانات مساحة العمل الخاصة.', 'auth'),
            step('tenant', 'Resolve the tenant scope used to restrict the query.', 'حدّد نطاق المستأجر الذي يقيّد الاستعلام.', 'tenant'),
            step('postgres', 'Read the dashboard rows with the request’s access constraints.', 'اقرأ صفوف لوحة التحكم ضمن قيود الوصول الخاصة بالطلب.'),
            step('api', 'Prepare a response from the database results.', 'جهّز الاستجابة من نتائج قاعدة البيانات.'),
            browser('Update the dashboard with the returned workspace data.', 'حدّث لوحة التحكم ببيانات مساحة العمل المستلمة.')
        ] },
        signIn: { title: ['Sign in', 'تسجيل الدخول'], auth: true, steps: [
            browser('Submit sign-in credentials over HTTPS.', 'أرسل بيانات تسجيل الدخول عبر HTTPS.'),
            step('api', 'Validate the request and ask the identity service to verify it.', 'تحقّق من الطلب واطلب من خدمة الهوية التحقق منه.'),
            step('auth', 'Verify identity and issue a session on success.', 'تحقّق من الهوية وأنشئ جلسة عند النجاح.'),
            browser('Open the workspace using the new session.', 'افتح مساحة العمل باستخدام الجلسة الجديدة.')
        ] },
        report: report(['Generate report', 'إنشاء تقرير'])
    },
    ecommerce: {
        browse: { title: ['Browse products', 'تصفّح المنتجات'], steps: [
            browser('Select a category in the storefront.', 'اختر فئة في المتجر.'),
            step('api', 'Translate the category and pagination into a catalog query.', 'حوّل الفئة والترقيم إلى استعلام في الكتالوج.'),
            step('postgres', 'Read matching product names, prices and availability.', 'اقرأ أسماء المنتجات المطابقة وأسعارها وتوفّرها.'),
            browser('Replace the product grid with the matching results.', 'حدّث شبكة المنتجات بالنتائج المطابقة.')
        ] },
        cart: { title: ['Add to cart', 'الإضافة إلى السلة'], steps: [
            browser('Choose a product and quantity.', 'اختر منتجًا وكمية.'),
            browser('Add or update the item in the local cart.', 'أضف العنصر أو حدّثه في السلة المحلية.'),
            browser('Update the bag count and subtotal. Checkout validates the final total.', 'حدّث عدد عناصر السلة والمجموع الفرعي. يتحقّق الخادم من الإجمالي عند إتمام الطلب.')
        ] },
        checkout: { title: ['Checkout', 'إتمام الطلب'], queue: true, steps: [
            browser('Submit the cart and delivery details.', 'أرسل السلة وتفاصيل التوصيل.'),
            step('api', 'Validate quantities and calculate the order total on the server.', 'تحقّق من الكميات واحسب إجمالي الطلب على الخادم.'),
            step('auth', 'Verify the customer session if authentication is enabled.', 'تحقّق من جلسة العميل إذا كانت المصادقة مفعّلة.', 'auth'),
            step('postgres', 'Commit the order and its line items together.', 'احفظ الطلب وبنوده في معاملة واحدة.'),
            step('queue', 'Enqueue a fulfillment follow-up using the committed order ID.', 'أضف مهمة متابعة الشحن باستخدام معرّف الطلب المحفوظ.'),
            browser('Show the order confirmation while follow-up runs separately.', 'اعرض تأكيد الطلب بينما تُنفّذ المتابعة بشكل منفصل.'),
            { ...step('workers', 'Pick up the queued fulfillment task independently of checkout.', 'التقط مهمة الشحن من القائمة بشكل مستقل عن إتمام الطلب.'), branchFrom: 'queue' }
        ] }
    },
    landing: {
        demo: { title: ['Submit demo form', 'إرسال طلب عرض'], steps: [
            browser('Validate the form fields and submit the demo request.', 'تحقّق من حقول النموذج وأرسل طلب العرض.'),
            step('api', 'Validate the email and normalize the input on the server.', 'تحقّق من البريد الإلكتروني ونسّق المدخلات على الخادم.'),
            step('postgres', 'Store the demo request for follow-up.', 'احفظ طلب العرض للمتابعة.'),
            browser('Show a confirmation once the request has been accepted.', 'اعرض تأكيدًا بعد قبول الطلب.')
        ] },
        brochure: { title: ['Download brochure', 'تنزيل الكتيّب'], steps: [
            browser('Select the downloadable brochure on the landing page.', 'اختر الكتيّب القابل للتنزيل من صفحة الهبوط.'),
            browser('Request the static file from the site host without a database query.', 'اطلب الملف الثابت من مضيف الموقع دون استعلام قاعدة البيانات.'),
            browser('Hand the downloaded file to the browser’s download manager.', 'سلّم الملف إلى مدير التنزيلات في المتصفح.')
        ] }
    },
    'internal-tool': {
        filter: { title: ['Filter records', 'تصفية السجلات'], steps: [
            browser('Choose a status filter in the operations inbox.', 'اختر عامل تصفية للحالة في صندوق العمليات.'),
            step('api', 'Validate the filter and apply any record access rules.', 'تحقّق من عامل التصفية وطبّق قواعد الوصول إلى السجلات.'),
            step('postgres', 'Return records matching the filter and access rules.', 'أعد السجلات المطابقة لعامل التصفية وقواعد الوصول.'),
            browser('Update the table while keeping the selected filter.', 'حدّث الجدول مع إبقاء عامل التصفية المحدد.')
        ] },
        approve: { title: ['Approve request', 'الموافقة على طلب'], steps: [
            browser('Submit an approval for the selected request.', 'أرسل الموافقة على الطلب المحدد.'),
            step('api', 'Check approval permission and whether the request is still pending.', 'تحقّق من صلاحية الموافقة ومن أن الطلب ما زال معلقًا.'),
            step('postgres', 'Write the status change as a transaction.', 'احفظ تغيير الحالة ضمن معاملة.'),
            browser('Show the updated request status to the operator.', 'اعرض حالة الطلب المحدّثة للمستخدم.')
        ] },
        report: report(['Export records', 'تصدير السجلات'])
    }
};
