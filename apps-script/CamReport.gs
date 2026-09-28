const CAM_REPORT_VERSION = "1.59";

// CAM Studio report formatting for the Google Apps Script web app.
// Returns text data to the extension; no browser APIs are used.
function renderCamReport(camData, currentBodyNamesByJob, decodedTree, bodyNamesResolvedByJob) {
    function getProperty(object, name) {
        return object == null ? undefined : object[name];
    }

    /*
     * =========================================================
     * UNIT FORMATTING
     * =========================================================
     */

    function cleanNumber(
        number,
        decimals = 4
    ) {

        if (!Number.isFinite(number)) {
            return String(number);
        }


        return String(
            Number(
                number.toFixed(decimals)
            )
        );
    }


    function formatLength(value) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return "(not found)";
        }


        const mm =
            Number(value);


        if (!Number.isFinite(mm)) {
            return String(value);
        }


        const inches =
            mm / 25.4;


        return (
            `${cleanNumber(inches, 4)} in ` +
            `(${cleanNumber(mm, 4)} mm)`
        );
    }


    function formatFeed(value) {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return "(not found)";
        }


        const mmPerMinute =
            Number(value);


        if (!Number.isFinite(mmPerMinute)) {
            return String(value);
        }


        const inchesPerMinute =
            mmPerMinute / 25.4;


        return (
            `${cleanNumber(inchesPerMinute, 3)} in/min ` +
            `(${cleanNumber(mmPerMinute, 3)} mm/min)`
        );
    }


    /*
     * =========================================================
     * DISPLAY HELPERS
     * =========================================================
     */

    function displayValue(value) {

        if (value === undefined) {
            return "(not found)";
        }

        if (value === null) {
            return "null";
        }

        if (typeof value === "boolean") {
            return value ? "Yes" : "No";
        }

        return String(value);
    }


    function addLine(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${displayValue(value)}`
        );
    }


    function addLength(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${formatLength(value)}`
        );
    }


    function addPercent(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${displayValue(value)}%`
        );
    }


    function addFeed(
        lines,
        label,
        value,
        indent = "  "
    ) {

        if (value === undefined) {
            return;
        }


        lines.push(
            `${indent}${label}: ${formatFeed(value)}`
        );
    }


    /*
     * =========================================================
     * CAM HIERARCHY
     * =========================================================
     */

    function buildHierarchy(operations) {

        const hierarchy = {

            machines: [],
            setups: []
        };


        let currentSetup =
            null;


        for (const operation of operations) {

            const type =
                getProperty(
                    operation,
                    "operationType"
                );


            const name =
                getProperty(
                    operation,
                    "name"
                ) || "(unnamed)";


            if (type === "Machine") {

                hierarchy.machines.push({

                    name,
                    object: operation
                });

                continue;
            }


            if (type === "Setup") {

                currentSetup = {

                    name,
                    object: operation,

                    tools: [],
                    toolpaths: []
                };


                hierarchy.setups.push(
                    currentSetup
                );

                continue;
            }


            if (
                type === "Tool" &&
                currentSetup
            ) {

                currentSetup.tools.push({

                    name,
                    object: operation
                });

                continue;
            }


            if (
                type === "ToolPath" &&
                currentSetup
            ) {

                currentSetup.toolpaths.push({

                    name,
                    object: operation
                });
            }
        }


        return hierarchy;
    }


    /*
     * =========================================================
     * MACHINE
     * =========================================================
     */

    function reportMachine(
        machine,
        lines
    ) {

        lines.push("");
        lines.push(
            `MACHINE: ${machine.name}`
        );

        const settings =
            (
                getProperty(
                    machine.object,
                    "postSettings"
                )
            ) || {};


        if (settings.outputUnit === "Metric") {
            lines.push("  ✓ Output unit: Metric");
        } else if (settings.outputUnit === "Imperial") {
            lines.push("  ✕ Output unit: Imperial → Set to Metric");
        } else {
            lines.push("  ? Output unit: " +
                (settings.outputUnit === undefined ? "(not found)" : displayValue(settings.outputUnit)) +
                " → Verify in CAM Studio");
        }


    }


    /*
     * =========================================================
     * SETUP
     * =========================================================
     */

    function findWorkPlaneSettings(value, depth = 0) {

        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            depth > 6
        ) {
            return null;
        }


        const keys =
            Object.keys(value);

        function findKey(aliases) {

            return aliases
                .map(
                    alias =>
                        keys.find(
                            key =>
                                key
                                    .toLowerCase()
                                    .replace(/[^a-z]/g, "") === alias
                        )
                )
                .find(Boolean);
        }


        const originKey =
            findKey([
                "origintype",
                "workplaneorigintype",
                "origin",
                "workplaneorigin"
            ]);

        const orientationKey =
            findKey([
                "directiontype",
                "workplanedirectiontype",
                "orientationtype",
                "workplaneorientationtype",
                "direction",
                "workplanedirection",
                "orientation",
                "workplaneorientation"
            ]);


        if (
            originKey &&
            orientationKey
        ) {
            return {
                origin: value[originKey],
                orientation: value[orientationKey]
            };
        }


        const orderedKeys =
            keys.sort(
                (a, b) =>
                    Number(/work.?plane/i.test(b)) -
                    Number(/work.?plane/i.test(a))
            );


        for (const key of orderedKeys) {

            const result =
                findWorkPlaneSettings(
                    value[key],
                    depth + 1
                );

            if (result) {
                return result;
            }
        }


        return null;
    }


    function reportSetup(
        setup,
        lines
    ) {

        lines.push("");
        lines.push(
            `SETUP: ${setup.name}`
        );


        const setupData =
            (
                setup.object
            ) || {};

        const setupParameters =
            setupData.setupParameters || {};


        const workPlane =
            findWorkPlaneSettings(
                setupData
            ) ||
            findWorkPlaneSettings(
                setupParameters
            ) || {};


        const origin =
            workPlane.origin ??
            setupParameters.workPlaneOrigin ??
            setupParameters.workPlaneOriginType ??
            "(not found)";

        const orientation =
            workPlane.orientation ??
            setupParameters.workPlaneOrientation ??
            setupParameters.workPlaneDirectionType ??
            "(not found)";


        lines.push(
            "=============================="
        );


        addLine(
            lines,
            "Origin",
            origin,
            "    "
        );


        addLine(
            lines,
            "Orientation",
            orientation,
            "    "
        );
    }


    /*
     * =========================================================
     * TOOL
     * =========================================================
     */

    function reportTool(
        tool,
        lines
    ) {

        lines.push("");
        lines.push(
            `  TOOL: ${tool.name}`
        );


        const cutter =
            (
                getProperty(
                    tool.object,
                    "cutter"
                )
            ) || {};


        addLine(
            lines,
            "Cutter type",
            cutter.cutterType,
            "    "
        );

        addLength(
            lines,
            "Diameter",
            cutter.diameter,
            "    "
        );
    }


    /*
     * =========================================================
     * COMMON TOOLPATH SETTINGS
     * =========================================================
     */

    function formatSpindleSpeed(value, useGrouping) {
        if (value === undefined || value === "") return "(not found)";
        if (value === null) return "null";

        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return displayValue(value);

        const formatted = cleanNumber(numeric, 3);
        return useGrouping
            ? formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            : formatted;
    }


    function addSpindleSpeed(lines, value, policy) {
        if (policy === "drill") {
            const numeric = Number(value);
            const isWithinRange =
                Number.isFinite(numeric) && numeric >= 8000 && numeric <= 12000;
            lines.push(
                `      ${isWithinRange ? "✓" : "✕"} Spindle speed: ${formatSpindleSpeed(value, false)} (8,000~12,000)`
            );
            return;
        }

        if (policy === "mill") {
            const numeric = Number(value);
            const isTargetSpeed = Number.isFinite(numeric) && numeric === 24000;
            lines.push(
                `      ${isTargetSpeed ? "✓" : "✕"} Spindle speed: ${formatSpindleSpeed(value, true)} (24,000)`
            );
            return;
        }

        addLine(lines, "Spindle speed", value, "      ");
    }


    function reportFeedSpeed(
        parameters,
        lines,
        spindlePolicy
    ) {

        const custom =
            parameters.customParameters || {};

        const machining =
            parameters.machiningParameters || {};

        const post =
            custom.postParameters || {};


        lines.push("");
        lines.push(
            "    FEED/SPEED"
        );


        addSpindleSpeed(lines, post.spindleSpeed, spindlePolicy);

        addFeed(
            lines,
            "Feed rate",
            machining.feedRate,
            "      "
        );

        addFeed(
            lines,
            "Entry feed rate",
            machining.entryRate,
            "      "
        );

        addFeed(
            lines,
            "Exit feed rate",
            machining.exitRate,
            "      "
        );

        addFeed(
            lines,
            "Plunge feed rate",
            machining.plungeFeedRate,
            "      "
        );

        addFeed(
            lines,
            "Retract feed rate",
            machining.retractFeedRate,
            "      "
        );

        addLength(
            lines,
            "Cut tolerance",
            machining.cutTolerance,
            "      "
        );



    }

    function reportHeights(parameters, lines) {
        const custom = parameters.customParameters || {};
        const heights = custom.heightsParameters || {};
        const link = custom.linkParameters || {};

        lines.push("");
        lines.push(
            "    HEIGHTS"
        );


        addLine(
            lines,
            "Start height type",
            heights.startHeightType,
            "      "
        );

        addLength(
            lines,
            "Start height",
            heights.startHeight,
            "      "
        );

        addLine(
            lines,
            "End height type",
            heights.endHeightType,
            "      "
        );

        addLength(
            lines,
            "End height",
            heights.endHeight,
            "      "
        );


        addLine(
            lines,
            "Clearance height type",
            link.clearanceHeightType,
            "      "
        );

        addLength(
            lines,
            "Clearance height",
            link.clearanceHeight,
            "      "
        );
    }



    /*
     * =========================================================
     * HOLE MAKING
     * =========================================================
     */

    function reportHoleMaking(
        toolpath,
        parameters,
        lines
    ) {

        const machining =
            parameters.machiningParameters || {};


        const calculation =
            machining
                .calculationMethodsParameters || {};


        const holeMaking =
            calculation
                .holeMakingParameters || {};


        const strategy =
            holeMaking
                .holeMakingMainStrategy;


        lines.push("");
        lines.push(
            `  OPERATION: ${toolpath.name}`
        );

        lines.push(
            "  ----------------------------"
        );

        addLine(
            lines,
            "Strategy",
            strategy,
            "    "
        );


        reportFeedSpeed(
            parameters,
            lines,
            strategy === "Drilling" ? "drill" : undefined
        );


        lines.push("");
        lines.push(
            "    HOLE MAKING"
        );


        if (strategy === "Drilling") {

            const drilling =
                holeMaking
                    .holeMakingDrillingParameters || {};

            addLine(
                lines,
                "Breakthrough",
                drilling.breaktroughFlag,
                "      "
            );


            if (
                drilling.breaktroughFlag === true
            ) {

                addLength(
                    lines,
                    "Breakthrough distance",
                    drilling.breaktroughDistance,
                    "      "
                );
            }
        }

        if (strategy !== "Drilling") reportHeights(parameters, lines);
    }


    /*
     * =========================================================
     * CUTTER COMPENSATION
     * =========================================================
     */

    function reportCompensation(
        wireframe,
        lines
    ) {

        const compensation =
            wireframe
                .cutterRadiusCompensationParameters || {};


        lines.push("");
        lines.push(
            "    CUTTER COMPENSATION"
        );


        addLine(
            lines,
            "Compensation type",
            compensation.compensationType,
            "      "
        );


        const offsetValue = compensation.compensationRadius;
        const hasOffsetValue =
            offsetValue !== undefined &&
            offsetValue !== null &&
            offsetValue !== "";
        const numericOffset = Number(offsetValue);
        const offsetIsZero = hasOffsetValue && numericOffset === 0;
        const offsetIsNonZero = hasOffsetValue && numericOffset !== 0;

        addLength(
            lines,
            offsetIsZero
                ? "✓ Cutter Compensation Offset"
                : offsetIsNonZero
                    ? "▲ Cutter Compensation Offset"
                    : "Cutter Compensation Offset",
            offsetValue,
            "      "
        );


        /*
         * Zero wear is not a useful active setting, so only show
         * non-zero wear values.
         */
        if (
            compensation.wearAmount !== undefined &&
            Number(compensation.wearAmount) !== 0
        ) {

            addLength(
                lines,
                "Wear amount",
                compensation.wearAmount,
                "      "
            );
        }



    }


    /*
     * =========================================================
     * TWO AXIS PROFILE
     * =========================================================
     */

    function reportStepDown(roughing, lines) {
        lines.push("");
        lines.push("    STEP DOWN");
        addLine(lines, "Step down type", roughing.depthStepMode, "      ");
        addLength(lines, "Step down", roughing.depthStep, "      ");
        addLine(lines, "First step down enabled", roughing.firstDepthStepFlag, "      ");
        addLength(lines, "First step down", roughing.firstDepthStep, "      ");
        addLine(lines, "Last step down enabled", roughing.finalDepthStepFlag, "      ");
        addLength(lines, "Last step down", roughing.finalDepthStep, "      ");
    }

    function reportTwoAxisProfile(
        wireframe,
        lines
    ) {

        reportCompensation(
            wireframe,
            lines
        );


        /*
         * DEPTH STEPPING
         */

        const roughing = wireframe.roughingParameters || {};
        reportStepDown(roughing, lines);



    }


    /*
     * =========================================================
     * TWO AXIS ROUGH
     * =========================================================
     */

    function reportTwoAxisRough(
        wireframe,
        machining,
        stepOverParameters,
        lines
    ) {

        reportCompensation(
            wireframe,
            lines
        );


        const roughing =
            wireframe.roughingParameters || {};


        lines.push("");
        lines.push("    STEP OVER");
        const stepOverType = stepOverParameters.maximumStepOverType;
        const normalizedStepOverType = String(stepOverType || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const usesToolDiameterPercentage =
            normalizedStepOverType === "tooldiameterpercentage" ||
            normalizedStepOverType === "tooldiameterpercent";

        if (stepOverType !== undefined) {
            const displayStepOverType = {
                toolDiameterPercentage: "Tool diameter %",
                toolDiameterPercent: "Tool diameter %",
                cuspHeight: "Cusp height",
                distance: "Distance"
            }[stepOverType] || displayValue(stepOverType);
            lines.push(
                `      ${usesToolDiameterPercentage ? "✓" : "✕"} Maximum step over type: ${displayStepOverType}`
            );
        }

        if (usesToolDiameterPercentage) {
            addPercent(lines, "Maximum step over", machining.maximumStepOverDistance, "      ");
        } else {
            addLength(lines, "Maximum step over", machining.maximumStepOverDistance, "      ");
        }

        reportStepDown(roughing, lines);


        /*
         * Only show offsets when they are actually non-zero.
         */

        if (
            roughing.roughingOffset !== undefined &&
            Number(roughing.roughingOffset) !== 0
        ) {

            addLength(
                lines,
                "Roughing offset",
                roughing.roughingOffset,
                "      "
            );
        }


        if (
            roughing.roughingRadialOffset !== undefined &&
            Number(roughing.roughingRadialOffset) !== 0
        ) {

            addLength(
                lines,
                "Radial offset",
                roughing.roughingRadialOffset,
                "      "
            );
        }


        if (
            roughing.roughingAxialOffset !== undefined &&
            Number(roughing.roughingAxialOffset) !== 0
        ) {

            addLength(
                lines,
                "Axial offset",
                roughing.roughingAxialOffset,
                "      "
            );
        }



    }


    /*
     * =========================================================
     * WIREFRAME ROUTER
     * =========================================================
     */

    function reportWireframe(
        toolpath,
        parameters,
        lines
    ) {

        const machining =
            parameters.machiningParameters || {};

        const custom =
            parameters.customParameters || {};

        const calculation =
            machining
                .calculationMethodsParameters || {};

		const wireframe =
			calculation
				.wireframeParameters || {};

        const pattern =
            wireframe.pattern;

        lines.push("");
        lines.push(
            `  OPERATION: ${toolpath.name}`
        );

        lines.push(
            "  ----------------------------"
        );

        const millPattern = machining.machiningType;
        if (pattern === "TwoAxisProfile") {
            const isOneWay = millPattern === "OneWay";
            lines.push(`    Pattern: ${pattern.toUpperCase()}`);
            lines.push(
                `     ${isOneWay ? "✓" : "✕"} Cutting Method: ${displayValue(millPattern)}` +
                (isOneWay ? "" : " → Set to OneWay")
            );
        } else if (pattern === "TwoAxisRough") {
            lines.push(`    Pattern: ${pattern.toUpperCase()}`);
            addLine(lines, "Sub Pattern", wireframe.roughType, "    ");
            addLine(lines, "Cutting Method", millPattern, "    ");
        } else {
            addLine(
                lines,
                "Mill pattern",
                millPattern,
                "    "
            );
        }

        reportFeedSpeed(
            parameters,
            lines,
            pattern === "TwoAxisProfile" || pattern === "TwoAxisRough"
                ? "mill"
                : undefined
        );


        /*
         * IMPORTANT:
         *
         * Routing is based on the actual CAM JSON pattern.
         * The operation's user-editable name is ignored.
         */

        if (
            pattern === "TwoAxisProfile"
        ) {

            reportTwoAxisProfile(
                wireframe,
                lines
            );

            return;
        }


        if (
            pattern === "TwoAxisRough"
        ) {

            reportTwoAxisRough(
                wireframe,
                machining,
                custom.stepOverParameters || {},
                lines
            );

            return;
        }


        lines.push("");
        lines.push(
            "    WIREFRAME"
        );

        lines.push(
            `      Pattern parser not implemented: ${pattern}`
        );
    }


    /*
     * =========================================================
     * TOOLPATH ROUTER
     * =========================================================
     */

    function reportToolPath(
        toolpath,
        lines
    ) {

        const parameters =
            (
                getProperty(
                    toolpath.object,
                    "toolPathParameters"
                )
            ) || {};


        const calculation =
            parameters
                ?.machiningParameters
                ?.calculationMethodsParameters || {};


        const method =
            calculation.method;


        if (
            method === "HoleMaking"
        ) {

            reportHoleMaking(
                toolpath,
                parameters,
                lines
            );

            return;
        }


        if (
            method === "Wireframe"
        ) {

            reportWireframe(
                toolpath,
                parameters,
                lines
            );

            return;
        }


        lines.push("");
        lines.push(
            `  OPERATION: ${toolpath.name}`
        );

        lines.push(
            "  ----------------------------"
        );


        lines.push(
            "    Parser not implemented for this method."
        );
    }


    /*
     * =========================================================
     * REPORT
     * =========================================================
     */

    function buildReport(
        jobName,
        hierarchy,
        bodyNames,
        stockDirectionType
    ) {

        const lines = [];


        lines.push(
            `JOB: ${jobName}`
        );
        lines.push(
            `  Bodies: ${bodyNames.length ? bodyNames.join(", ") : "(none selected)"}`
        );
        addLine(lines, "Stock Direction Type", stockDirectionType, "  ");


        for (
            const machine
            of hierarchy.machines
        ) {

            reportMachine(
                machine,
                lines
            );
        }


        for (
            const setup
            of hierarchy.setups
        ) {

            reportSetup(
                setup,
                lines
            );


            for (
                const tool
                of setup.tools
            ) {

                reportTool(
                    tool,
                    lines
                );
            }


            for (
                const toolpath
                of setup.toolpaths
            ) {

                reportToolPath(
                    toolpath,
                    lines
                );
            }
        }


        return lines.join("\n");
    }



  const tree = decodedTree || decodeCamTree_(camData?.tree);
  const jobs = Array.isArray(tree?.jobs) ? tree.jobs : [];
  if (jobs.length === 0) throw new Error("No CAM jobs were found.");
  const components = Array.isArray(tree.components) ? tree.components : [];
  const componentIndexByNodeId = new Map();
  const componentIndexByReferenceId = new Map();
  components.forEach((component, index) => {
    if (!component) return;
    if (!componentIndexByNodeId.has(component._nodeId)) {
      componentIndexByNodeId.set(component._nodeId, index);
    }
    if (!componentIndexByReferenceId.has(component.referenceId)) {
      componentIndexByReferenceId.set(component.referenceId, index);
    }
  });
  return jobs.map((job, jobIndex) => {
    const jobName = getProperty(job, "name") || "(unnamed job)";
    const selections = job.selectionParameters?.bodies?.associativeSelections || [];
    const bodyNames = selections.map((selection, selectionIndex) => {
      const currentName = currentBodyNamesByJob?.[jobIndex]?.[selectionIndex];
      const nodeIndex = componentIndexByNodeId.get(selection.componentId);
      const referenceIndex = componentIndexByReferenceId.get(selection.componentRef);
      const hasNodeMatch = componentIndexByNodeId.has(selection.componentId);
      const hasReferenceMatch = componentIndexByReferenceId.has(selection.componentRef);
      let componentIndex;
      if (!hasNodeMatch) componentIndex = hasReferenceMatch ? referenceIndex : undefined;
      else if (!hasReferenceMatch) componentIndex = nodeIndex;
      else componentIndex = Math.min(nodeIndex, referenceIndex);
      const component = componentIndex === undefined ? undefined : components[componentIndex];
      const name = typeof currentName === "string" && currentName.trim()
        ? currentName
        : component?.name || "(unresolved body)";
      const resolvedStatus = bodyNamesResolvedByJob?.[jobIndex];
      const resolved = Array.isArray(resolvedStatus)
        ? resolvedStatus[selectionIndex] === true
        : true;
      return !resolved && name !== "(unresolved body)"
        ? `${name} (CAM fallback)`
        : name;
    });
    const stockDirectionType = job.stock?.directionType;
    const operations = job.operations;
    if (!Array.isArray(operations)) throw new Error("Job operations array was not found.");
    return buildReport(jobName, buildHierarchy(operations), bodyNames, stockDirectionType);
  }).join("\n\n");
}
